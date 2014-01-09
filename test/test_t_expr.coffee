should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
d_expr = require "#{wibble}/dump/d_expr"
p_expr = require "#{wibble}/parser/p_expr"
t_expr = require "#{wibble}/transform/t_expr"
test_util = require './test_util'

describe "Transform expressions", ->
  parse = (line, options) -> test_util.parseWith(p_expr.expression, line, options)

  it "dump strings", ->
    d_expr.dumpExpr(parse("\"abc\\u000adef\"")).should.eql("\"abc\\ndef\"")
    d_expr.dumpExpr(parse("\"wut\\u0123\\\"\"")).should.eql("\"wut\\u0123\\\"\"")

  it "dump functions", ->
    d_expr.dumpExpr(parse("-> 3")).should.eql("-> 3")
    d_expr.dumpExpr(parse("(x: Int, y: Int) -> x * y")).should.eql("(x: Int, y: Int) -> x * y")
    d_expr.dumpExpr(parse("(a: Boolean = false) -> true")).should.eql("(a: Boolean = false) -> true")
    d_expr.dumpExpr(parse("(x: (List(String), String)) -> true")).should.eql("(x: (List(String), String)) -> true")

  it "dump locals", ->
    d_expr.dumpExpr(parse("{ val x = 9 + a }")).should.eql("{ val x = 9 + a }")

  describe "flattenInfix", ->
    infix = (line, options) -> d_expr.dumpExpr(t_expr.flattenInfix(parse(line, options)))

    it "binary", ->
      infix("3 + 4").should.eql("3.+ 4")
      infix("a + b * c + d").should.eql("a.+(b.* c).+ d")
      infix("a + b * (c + d)").should.eql("a.+(b.*(c.+ d))")

    it "unary", ->
      infix("not a").should.eql("a.not()")

    it "nested", ->
      infix("45 * -9").should.eql("45.*(9.negative())")
      infix("if 3 + 5 < 12 then ok").should.eql("if 3.+ 5.< 12 then ok")
