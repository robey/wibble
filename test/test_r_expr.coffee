should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
r_expr = require "#{wibble}/runtime/r_expr"
r_scope = require "#{wibble}/runtime/r_scope"
transform = require "#{wibble}/transform"
test_util = require './test_util'

evalExpr = (line, options = {}) ->
  scope = options.scope or new transform.Scope()
  globals = options.globals or new r_scope.Scope()
  expr = parser.code.run(line, options)
  expr = transform.transformExpr(expr)
  [ expr, type ] = transform.typecheck(scope, expr, options)
  r_expr.evalExpr(expr, globals, options.logger)

stringify = (obj) ->
  "[#{obj.type.toRepr()}] #{obj.toRepr()}"


describe "Runtime evalExpr", ->
  it "nothing", ->
    stringify(evalExpr("()")).should.eql "[Nothing] ()"

  it "symbol", ->
    stringify(evalExpr(".coffee")).should.eql "[Symbol] .coffee"

  it "int", ->
    stringify(evalExpr("94110")).should.eql "[Int] 94110"

  it "basic math", ->
    stringify(evalExpr("1 - 2 + 3")).should.eql "[Int] 2"
    stringify(evalExpr("4 + 2 * 10")).should.eql "[Int] 24"
    stringify(evalExpr("101 % 5")).should.eql "[Int] 1"

  describe "scopes", ->
    it "resolve references", ->
      stringify(evalExpr("{ val a = 900; a }")).should.eql "[Int] 900"

    it "don't creep into each other", ->
      stringify(evalExpr("{ val x = 10; { val x = 3; x * 2 } + x }")).should.eql "[Int] 16"

  it "builds a function", ->
    stringify(evalExpr("(x: Int) -> x * x")).should.eql "[(x: Int) -> Int] { on (x: Int) -> x.* x }"

  it "manages state per function call", ->
    scope = new transform.Scope()
    globals = new r_scope.Scope()
    stringify(evalExpr("val square = (x: Int) -> x * x", scope: scope, globals: globals)).should.eql "[(x: Int) -> Int] { on (x: Int) -> x.* x }"
    stringify(evalExpr("val x = 100", scope: scope, globals: globals)).should.eql "[Int] 100"
    stringify(evalExpr("square 4", scope: scope, globals: globals)).should.eql "[Int] 16"
    stringify(evalExpr("square 20", scope: scope, globals: globals)).should.eql "[Int] 400"
    stringify(evalExpr("x", scope: scope, globals: globals)).should.eql "[Int] 100"
