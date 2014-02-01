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

  it "scope creep", ->
    stringify(evalExpr("{ val x = 10; { val x = 3; x * 2 } + x }")).should.eql "[Int] 16"
