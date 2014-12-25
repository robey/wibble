should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
dump = require "#{wibble}/dump"
parser = require "#{wibble}/parser"
t_expr = require "#{wibble}/transform/t_expr"
test_util = require './test_util'

describe "Transform expressions", ->
  parse = (line, options) -> test_util.parseWith(parser.expression, line, options)

  describe "flattenInfix", ->
    infix = (line, options) -> dump.dumpExpr(t_expr.flattenInfix(parse(line, options)))

    it "binary", ->
      infix("3 + 4").should.eql("3.+ 4")
      infix("a + b * c + d").should.eql("a.+(b.* c).+ d")
      infix("a + b * (c + d)").should.eql("a.+(b.*(c.+ d))")

    it "unary", ->
      infix("not a").should.eql("a.not")

    it "nested", ->
      infix("45 * -9").should.eql("45.*(9.negative)")
      infix("if 3 + 5 < 12 then ok").should.eql("if 3.+ 5.< 12 then ok")

    it "logical", ->
      infix("3 + 5 and 9 - 2").should.eql "3.+ 5 and 9.- 2"

  describe "normalizePostfix", ->
    postfix = (line, options) -> dump.dumpExpr(t_expr.normalizePostfix(parse(line, options)))

    it "_ unless _", ->
      postfix("3 unless true").should.eql("if true.not then 3 else ()")
      postfix("x.dump 9 unless y").should.eql("if y.not then x.dump 9 else ()")
