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
    typecheck("()").type.toRepr().should.eql "Nothing"
    typecheck("true").type.toRepr().should.eql "Boolean"
    typecheck("3").type.toRepr().should.eql "Int"
    typecheck(".foo").type.toRepr().should.eql "Symbol"
    typecheck(".*").type.toRepr().should.eql "Symbol"
    typecheck("\"hello\"").type.toRepr().should.eql "String"

  it "structs", ->
    (-> typecheck("(count = 10, true)")).should.throw /Positional fields can't/
    typecheck("(x = 9)").type.toRepr().should.eql "(x: Int = 9)"
    typecheck("(.a, .b, .c)").type.toRepr().should.eql "(?0: Symbol = .a, ?1: Symbol = .b, ?2: Symbol = .c)"
    (-> typecheck("(a = 1, b = 2, a = 1)")).should.throw /repeated/

  it "references", ->
    scope = new transform.Scope()
    scope.add("point", new transform.NamedType("Point"), null)
    typecheck("point", scope: scope).type.toRepr().should.eql "Point"

  it "calls", ->
    typecheck("3 .+").type.toRepr().should.eql "Int -> Int"
    typecheck("(3 .+) 3").type.toRepr().should.eql "Int"

  it "condition", ->
    typecheck("if true then 3 else 4").type.toRepr().should.eql "Int"
    typecheck("if true then 3 else true").type.toRepr().should.eql "Int | Boolean"
    typecheck("if true then 3").type.toRepr().should.eql "Int | Nothing"
    (-> typecheck("if 3 then 3 else 4")).should.throw /true or false/

  describe "new", ->
    it "symbol", ->
      x = typecheck("new { on .foo -> 3 }")
      x.type.toRepr().should.eql "[.foo -> Int]"
      d_expr.dumpExpr(x.expr).should.eql "new [.foo -> Int] { on .foo -> 3 }"
  
    it "nothing", ->
      x = typecheck("new { val hidden = .ok; on () -> true }")
      x.type.toRepr().should.eql "() -> Boolean"
      d_expr.dumpExpr(x.expr).should.eql "new () -> Boolean { val hidden = .ok; on () -> true }"
      # verify that inner locals were type-checked
      x.expr.newObject.scope.get("hidden").toRepr().should.eql "Symbol"

    it "inner reference", ->
      x = typecheck("new { on (x: Int) -> x }")
      x.type.toRepr().should.eql "(x: Int) -> Int"
      d_expr.dumpExpr(x.expr).should.eql "new (x: Int) -> Int { on (x: Int) -> x }"

    it "generates a scope for 'on' handlers", ->
      x = typecheck("new { on (x: Int) -> x .+ 2 }")
      x.expr.newObject.code[0].scope.get("x").toRepr().should.eql "Int"

    it "can do forward references from inside the closure", ->
      x = typecheck("new { on (x: Int) -> { y + 3 }; val y = 10 }")
      x.type.toRepr().should.eql "(x: Int) -> Int"

    it "can still trap unknown references inside the closure", ->
      (-> typecheck("new { on (x: Int) -> { y + 3 } }")).should.throw /reference/

  it "locals", ->
    x = typecheck("val x = 3")
    x.type.toRepr().should.eql "Int"

  describe "code", ->
    it "empty", ->
      x = typecheck("{ }")
      x.type.toRepr().should.eql "Nothing"

    it "finds a local", ->
      x = typecheck("{ val x = 9 }")
      x.expr.scope.get("x").toRepr().should.eql "Int"

    it "resolves inner references", ->
      x = typecheck("{ val x = true; x }")
      x.type.toRepr().should.eql "Boolean"
      x.expr.scope.get("x").toRepr().should.eql "Boolean"

    it "gets unhappy about duped vars", ->
      (-> typecheck("{ val x = 9; val x = 3 }")).should.throw /Redefined/

    it "gets unhappy about forward references", ->
      (-> typecheck("{ val y = 3 + x; val x = 9 }")).should.throw /reference/

    it "allows nested duped vars", ->
      x = typecheck("{ val x = 9; { val x = 3 } }")
      x.expr.scope.exists("x").should.eql true
      x.expr.code[1].scope.exists("x").should.eql true

  it "merges sub-branches", ->
    x = typecheck("if true then 0 else if false then 1 else 2")
    x.type.toRepr().should.eql "Int"

  it "handles single recursion", ->
    (-> typecheck("{ val sum = (n: Int) -> sum(n - 1) }")).should.throw /Recursive/
    x = typecheck("{ val sum = (n: Int): Int -> if n == 0 then 0 else n + sum(n - 1) }")
    x.type.toRepr().should.eql "(n: Int) -> Int"

  it "checks single recursion", ->
    typecheck("{ val sum = (n: Int) -> n * 2 }").type.toRepr().should.eql "(n: Int) -> Int"
    (-> typecheck("{ val sum = (n: Int): Int -> .wut }")).should.throw "Expected type Int; inferred type Symbol"

  it "handles double recursion", ->
    even = "if n == 0 then 0 else odd(n - 1)"
    odd = "if n == 1 then 1 else even(n - 1)"
    (-> typecheck("{ val even = (n: Int) -> #{even}; val odd = (n: Int) -> #{odd} }")).should.throw /Recursive/
    x = typecheck("{ val even = (n: Int): Int -> #{even}; val odd = (n: Int): Int -> #{odd} }")
    x.type.toRepr().should.eql "(n: Int) -> Int"
