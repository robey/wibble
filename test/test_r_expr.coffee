should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
r_expr = require "#{wibble}/runtime/r_expr"
r_namespace = require "#{wibble}/runtime/r_namespace"
transform = require "#{wibble}/transform"
test_util = require './test_util'

evalExpr = (line, options = {}) ->
  scope = options.scope or new transform.Scope()
  globals = options.globals or new r_namespace.Namespace()
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

  describe "namespaces", ->
    it "resolve references", ->
      stringify(evalExpr("{ a = 900; a }")).should.eql "[Int] 900"

    it "don't creep into each other", ->
      stringify(evalExpr("{ x = 10; { x = 3; x * 2 } + x }")).should.eql "[Int] 16"

  it "builds a function", ->
    stringify(evalExpr("(x: Int) -> x * x")).should.eql "[(x: Int) -> Int] { on (x: Int) -> x.* x }"

  it "manages state per function call", ->
    scope = new transform.Scope()
    globals = new r_namespace.Namespace()
    stringify(evalExpr("square = (x: Int) -> x * x", scope: scope, globals: globals)).should.eql "[(x: Int) -> Int] { on (x: Int) -> x.* x }"
    stringify(evalExpr("x = 100", scope: scope, globals: globals)).should.eql "[Int] 100"
    stringify(evalExpr("square 4", scope: scope, globals: globals)).should.eql "[Int] 16"
    stringify(evalExpr("square 20", scope: scope, globals: globals)).should.eql "[Int] 400"
    stringify(evalExpr("x", scope: scope, globals: globals)).should.eql "[Int] 100"

  it "handles record parameters", ->
    scope = new transform.Scope()
    globals = new r_namespace.Namespace()
    stringify(evalExpr("sub = (total: Int, without: Int = 1) -> total - without", scope: scope, globals: globals)).should.eql \
      "[(total: Int, without: Int = 1) -> Int] { on (total: Int, without: Int = 1) -> total.- without }"
    stringify(evalExpr("sub(100, 5)", scope: scope, globals: globals)).should.eql "[Int] 95"
    stringify(evalExpr("sub(100)", scope: scope, globals: globals)).should.eql "[Int] 99"
    stringify(evalExpr("sub(without=9, total=20)", scope: scope, globals: globals)).should.eql "[Int] 11"



