should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
t_object = require "#{wibble}/transform/t_object"
d_expr = require "#{wibble}/dump/d_expr"
test_util = require './test_util'

describe "Transform objects", ->
  parse = (line, options) -> parser.code.run(line, options)
  checkHandlers = (line, options) -> t_object.checkHandlers(parse(line, options))
  crushFunctions = (line, options) -> t_object.crushFunctions(parse(line, options))

  it "requires an 'on' inside a 'new'", ->
    (-> checkHandlers("new { 3 }")).should.throw /'new' expression must contain/
    checkHandlers("new { on .x -> 3 }")
    (-> checkHandlers("new { if true then { on .x -> 3 } }")).should.throw /'new' expression must contain/

  it "requires a 'new' around an 'on'", ->
    (-> checkHandlers("{ on .x -> 3 }")).should.throw /'on' handlers must be inside/
    (-> checkHandlers("{ if true then { on .x -> 3 } }")).should.throw /'on' handlers must be inside/
    checkHandlers("{ if true then { new { on .x -> 3 } } }")

  it "crushes functions", ->
    d_expr.dumpExpr(crushFunctions("-> 3 + 2")).should.eql "() -> 3 + 2"
