should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
d_expr = require "#{wibble}/dump/d_expr"
t_locals = require "#{wibble}/transform/t_locals"
t_scope = require "#{wibble}/transform/t_scope"
t_type = require "#{wibble}/transform/t_type"
t_typecheck = require "#{wibble}/transform/t_typecheck"
test_util = require './test_util'

describe "Typecheck", ->
  parse = (line, options) -> parser.code.run(line, options)
  typecheck = (line, options = {}) -> t_typecheck.typeExpr(options.scope or new t_scope.Scope(), parse(line, options))
  typecheckAndPack = (line, options = {}) ->
    scope = options.scope or new t_scope.Scope()
    expr = t_locals.packLocals(scope, parse(line, options), options)
    type = t_typecheck.typeExpr(scope, expr)
    { type, expr, scope }

  it "constants", ->
    typecheck("()").toRepr().should.eql "Nothing"
    typecheck("true").toRepr().should.eql "Boolean"
    typecheck("3").toRepr().should.eql "Int"
    typecheck(".foo").toRepr().should.eql "Symbol"
    typecheck(".*").toRepr().should.eql "Symbol"
    typecheck("\"hello\"").toRepr().should.eql "String"

  it "references", ->
    scope = new t_scope.Scope()
    scope.add("point", new t_type.NamedType("Point"), null)
    typecheck("point", scope: scope).toRepr().should.eql "Point"

  it "calls", ->
    typecheck("3 .+").toRepr().should.eql "Int -> Int"
    typecheck("(3 .+) 3").toRepr().should.eql "Int"

  describe "new", ->
    it "symbol", ->
      x = typecheckAndPack("new { on .foo -> 3 }")
      x.type.toRepr().should.eql "[.foo -> Int]"
      d_expr.dumpExpr(x.expr).should.eql "new [.foo -> Int] { on .foo -> 3 }"
  
    it "nothing", ->
      x = typecheckAndPack("new { val hidden = .ok; on () -> true }")
      x.type.toRepr().should.eql "() -> Boolean"
      d_expr.dumpExpr(x.expr).should.eql "new () -> Boolean { val hidden = .ok; on () -> true }"
      # verify that inner locals were type-checked
      x.expr.newObject.scope.get("hidden").type.toRepr().should.eql "Symbol"

    it "inner reference", ->
      x = typecheckAndPack("new { on (x: Int) -> x }")
      x.type.toRepr().should.eql "(x: Int) -> Int"
      d_expr.dumpExpr(x.expr).should.eql "new (x: Int) -> Int { on (x: Int) -> x }"

  it "locals", ->
    x = typecheckAndPack("val x = 3")
    x.type.toRepr().should.eql "Int"

  it "code", ->
    x = typecheckAndPack("{ val x = true; x }")
    x.type.toRepr().should.eql "Boolean"
    x.expr.scope.get("x").type.toRepr().should.eql "Boolean"
    x = typecheckAndPack("{ }")
    x.type.toRepr().should.eql "Nothing"
    