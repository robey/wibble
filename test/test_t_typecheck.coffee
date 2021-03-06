should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
d_expr = require "#{wibble}/dump/d_expr"
transform = require "#{wibble}/transform"
test_util = require './test_util'

describe "Typecheck", ->
  parse = (line, options) -> parser.code.run(line, options)

  typecheck = (line, options = {}) ->
    scope = options.scope or new transform.Scope()
    expr = parse(line, options)
    expr = transform.transformExpr(expr)
    [ expr, type ] = transform.typecheck(scope, expr, options)
    { type, expr, scope }

  it "constants", ->
    typecheck("()").type.inspect().should.eql "Nothing"
    typecheck("true").type.inspect().should.eql "Boolean"
    typecheck("3").type.inspect().should.eql "Int"
    typecheck(".foo").type.inspect().should.eql "Symbol"
    typecheck(".*").type.inspect().should.eql "Symbol"
    typecheck("\"hello\"").type.inspect().should.eql "String"

  it "structs", ->
    (-> typecheck("(count = 10, true)")).should.throw /Positional fields can't/
    typecheck("(x = 9)").type.inspect().should.eql "(x: Int = 9)"
    typecheck("(.a, .b, .c)").type.inspect().should.eql "(?0: Symbol = .a, ?1: Symbol = .b, ?2: Symbol = .c)"
    (-> typecheck("(a = 1, b = 2, a = 1)")).should.throw /repeated/

  it "references", ->
    scope = new transform.Scope()
    scope.add("point", new transform.NamedType("Point"), null)
    typecheck("point", scope: scope).type.inspect().should.eql "Point"

  it "calls", ->
    typecheck("3 .+").type.inspect().should.eql "Int -> Int"
    typecheck("(3 .+) 3").type.inspect().should.eql "Int"

  it "logic", ->
    (-> typecheck("3 and true")).should.throw /boolean/
    (-> typecheck("false or 9")).should.throw /boolean/
    typecheck("true and true").type.inspect().should.eql "Boolean"

  it "condition", ->
    typecheck("if true then 3 else 4").type.inspect().should.eql "Int"
    typecheck("if true then 3 else true").type.inspect().should.eql "Int | Boolean"
    typecheck("if true then 3").type.inspect().should.eql "Int | Nothing"
    (-> typecheck("if 3 then 3 else 4")).should.throw /true or false/

  describe "new", ->
    it "symbol", ->
      x = typecheck("new { on .foo -> 3 }")
      x.type.inspect().should.eql "[.foo -> Int]"
      d_expr.dumpExpr(x.expr).should.eql "new [.foo -> Int] { on .foo -> 3 }"
  
    it "nothing", ->
      x = typecheck("new { hidden = .ok; on () -> true }")
      x.type.inspect().should.eql "() -> Boolean"
      d_expr.dumpExpr(x.expr).should.eql "new () -> Boolean { hidden = .ok; on () -> true }"
      # verify that inner locals were type-checked
      x.expr.newObject.scope.get("hidden").inspect().should.eql "Symbol"

    it "inner reference", ->
      x = typecheck("new { on (x: Int) -> x }")
      x.type.inspect().should.eql "(x: Int) -> Int"
      d_expr.dumpExpr(x.expr).should.eql "new (x: Int) -> Int { on (x: Int) -> x }"

    it "generates a scope for 'on' handlers", ->
      x = typecheck("new { on (x: Int) -> x .+ 2 }")
      x.expr.newObject.code[0].scope.get("x").inspect().should.eql "Int"

    it "can do forward references from inside the closure", ->
      x = typecheck("new { on (x: Int) -> { y + 3 }; y = 10 }")
      x.type.inspect().should.eql "(x: Int) -> Int"

    it "can still trap unknown references inside the closure", ->
      (-> typecheck("new { on (x: Int) -> { y + 3 } }")).should.throw /reference/

  it "locals", ->
    x = typecheck("x = 3")
    x.type.inspect().should.eql "Int"

  describe "code", ->
    it "empty", ->
      x = typecheck("{ }")
      x.type.inspect().should.eql "Nothing"

    it "finds a local", ->
      x = typecheck("{ x = 9 }")
      x.expr.scope.get("x").inspect().should.eql "Int"

    it "resolves inner references", ->
      x = typecheck("{ x = true; x }")
      x.type.inspect().should.eql "Boolean"
      x.expr.scope.get("x").inspect().should.eql "Boolean"

    it "gets unhappy about duped vars", ->
      (-> typecheck("{ x = 9; x = 3 }")).should.throw /Redefined/

    it "gets unhappy about forward references", ->
      (-> typecheck("{ y = 3 + x; x = 9 }")).should.throw /reference/

    it "allows nested duped vars", ->
      x = typecheck("{ x = 9; { x = 3 } }")
      x.expr.scope.exists("x").should.eql true
      x.expr.code[1].scope.exists("x").should.eql true

  describe "functions", ->
    it "simple", ->
      func = "-> 3"
      typecheck(func).type.inspect().should.eql "() -> Int"
      typecheck("(#{func}) ()").type.inspect().should.eql "Int"

    it "as function parameters", ->
      func = "(f: Int -> Int) -> { (n: Int) -> f n * 2 }"
      typecheck(func).type.inspect().should.eql "(f: Int -> Int) -> (n: Int) -> Int"
      typecheck("(#{func}) ((n: Int) -> n + 1)").type.inspect().should.eql "(n: Int) -> Int"

    it "with parameters matched contravariantly", ->
      func = "(f: Int -> Int) -> { (n: Int) -> f n * 2 }"
      typecheck("(#{func}) ((n: Int, incr: Int = 1) -> n + incr)").type.inspect().should.eql "(n: Int) -> Int"

    it "simple type parameters", ->
      func = "(x: $A) -> x"
      typecheck(func).type.inspect().should.eql "(x: $A) -> $A"
      typecheck("(#{func}) 10").type.inspect().should.eql "Int"

    it "type parameters in a disjoint type", ->
      func = "(x: $A, y: Boolean) -> if y then x else 100"
      typecheck(func).type.inspect().should.eql "(x: $A, y: Boolean) -> ($A | Int)"
      typecheck("(#{func}) (10, true)").type.inspect().should.eql "Int"
      typecheck("(#{func}) (10, false)").type.inspect().should.eql "Int"

  it "merges sub-branches", ->
    x = typecheck("if true then 0 else if false then 1 else 2")
    x.type.inspect().should.eql "Int"

  it "handles single recursion", ->
    (-> typecheck("{ sum = (n: Int) -> sum(n - 1) }")).should.throw /Recursive/
    x = typecheck("{ sum = (n: Int): Int -> if n == 0 then 0 else n + sum(n - 1) }")
    x.type.inspect().should.eql "(n: Int) -> Int"

  it "checks single recursion", ->
    typecheck("{ sum = (n: Int) -> n * 2 }").type.inspect().should.eql "(n: Int) -> Int"
    (-> typecheck("{ sum = (n: Int): Int -> .wut }")).should.throw "Expected type Int; inferred type Symbol"

  it "handles double recursion", ->
    even = "if n == 0 then 0 else odd(n - 1)"
    odd = "if n == 1 then 1 else even(n - 1)"
    (-> typecheck("{ even = (n: Int) -> #{even}; odd = (n: Int) -> #{odd} }")).should.throw /Recursive/
    x = typecheck("{ even = (n: Int): Int -> #{even}; odd = (n: Int): Int -> #{odd} }")
    x.type.inspect().should.eql "(n: Int) -> Int"

  it "handles self-types", ->
    x = typecheck("new { on (x: @) -> true }")
    x.type.inspect().should.eql "(x: @) -> Boolean"
    