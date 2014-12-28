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
  if not options.rstate? then options.rstate = new r_expr.RuntimeState(locals: globals, logger: options.logger)
  r_expr.evalExpr(expr, options.rstate)

stringify = (obj) ->
  "[#{obj.type.inspect()}] #{obj.inspect()}"


describe "Runtime evalExpr", ->
  it "nothing", ->
    stringify(evalExpr("()")).should.eql "[Nothing] ()"

  it "symbol", ->
    stringify(evalExpr(".coffee")).should.eql "[Symbol] .coffee"

  it "int", ->
    stringify(evalExpr("94110")).should.eql "[Int] 94110"

  it "string", ->
    stringify(evalExpr("\"hello\"")).should.eql "[String] \"hello\""

  it "basic math", ->
    stringify(evalExpr("1 - 2 + 3")).should.eql "[Int] 2"
    stringify(evalExpr("4 + 2 * 10")).should.eql "[Int] 24"
    stringify(evalExpr("101 % 5")).should.eql "[Int] 1"

  it "logic", ->
    stringify(evalExpr("true or false")).should.eql "[Boolean] true"
    stringify(evalExpr("false or true")).should.eql "[Boolean] true"
    stringify(evalExpr("true and false")).should.eql "[Boolean] false"
    stringify(evalExpr("true and not false")).should.eql "[Boolean] true"

  describe "namespaces", ->
    it "resolve references", ->
      stringify(evalExpr("{ a = 900; a }")).should.eql "[Int] 900"

    it "don't creep into each other", ->
      stringify(evalExpr("{ x = 10; { x = 3; x * 2 } + x }")).should.eql "[Int] 16"

    it "nest inside 'new' correctly", ->
      stringify(evalExpr("{ x = new { value = 3; on .value -> value }; x.value }")).should.eql "[Int] 3"

  it "builds a function", ->
    stringify(evalExpr("(x: Int) -> x * x")).should.eql "[(x: Int) -> Int] (x: Int) -> x.* x"

  it "manages state per function call", ->
    scope = new transform.Scope()
    globals = new r_namespace.Namespace()
    stringify(evalExpr("square = (x: Int) -> x * x", scope: scope, globals: globals)).should.eql "[(x: Int) -> Int] (x: Int) -> x.* x"
    stringify(evalExpr("x = 100", scope: scope, globals: globals)).should.eql "[Int] 100"
    stringify(evalExpr("square 4", scope: scope, globals: globals)).should.eql "[Int] 16"
    stringify(evalExpr("square 20", scope: scope, globals: globals)).should.eql "[Int] 400"
    stringify(evalExpr("x", scope: scope, globals: globals)).should.eql "[Int] 100"

  it "handles record parameters", ->
    scope = new transform.Scope()
    globals = new r_namespace.Namespace()
    stringify(evalExpr("sub = (total: Int, without: Int = 1) -> total - without", scope: scope, globals: globals)).should.eql \
      "[(total: Int, without: Int = 1) -> Int] (total: Int, without: Int = 1) -> total.- without"
    stringify(evalExpr("sub(100, 5)", scope: scope, globals: globals)).should.eql "[Int] 95"
    stringify(evalExpr("sub(100)", scope: scope, globals: globals)).should.eql "[Int] 99"
    stringify(evalExpr("sub(without=9, total=20)", scope: scope, globals: globals)).should.eql "[Int] 11"

  it "recursively coerces struct parameters", ->
    scope = new transform.Scope()
    globals = new r_namespace.Namespace()
    evalExpr("go = (point: (x: Int, y: Int)) -> point.x * point.y", scope: scope, globals: globals)
    stringify(evalExpr("go(point = (5, 3))", scope: scope, globals: globals)).should.eql "[Int] 15"

  it "handles self-types", ->
    scope = new transform.Scope()
    rstate = new r_expr.RuntimeState()
    stringify(evalExpr("wut = new { on (x: @) -> 3 }", scope: scope, rstate: rstate)).should.eql "[(x: @) -> Int] new (x: @) -> Int { on (x: @) -> 3 }"
    stringify(evalExpr("wut wut", scope: scope, rstate: rstate)).should.eql "[Int] 3"

  it "does simple functions-of-functions metaprogramming", ->
    # "doubler" wraps an (Int -> Int) function by doubling the result
    # "incrementer" increments a number (by 1, by default)
    code = """
    {
      doubler = (f: Int -> Int) -> { (n: Int) -> f n * 2 }
      incrementer = (n: Int, add: Int = 1) -> n + add
      doubler incrementer 10
    }"""
    stringify(evalExpr(code)).should.eql "[Int] 22"

  it "allows overriding :inspect", ->
    scope = new transform.Scope()
    rstate = new r_expr.RuntimeState()
    r_expr.inspect(evalExpr("secret = new { on :inspect -> \"shh\" }", scope: scope, rstate: rstate), rstate).should.eql "\"shh\""
