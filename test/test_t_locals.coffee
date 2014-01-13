should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
t_locals = require "#{wibble}/transform/t_locals"
t_scope = require "#{wibble}/transform/t_scope"
test_util = require './test_util'

describe "Transform locals", ->
  parse = (line, options) -> parser.expression.run(line, options)
  packLocals = (line, options) -> t_locals.packLocals(new t_scope.Scope(), parse(line, options))

  it "finds a local", ->
    x = packLocals("{ val x = 9 }")
    x.scope.exists("x").should.eql true
    test_util.stateToPos(x.scope.get("x")).should.eql(number: "base10", value: "9", pos: [ 10, 11 ])

  it "gets unhappy about duped vars", ->
    (-> packLocals("{ val x = 9; val x = 3 }")).should.throw /Redefined/

  it "allows nested duped vars", ->
    x = packLocals("{ val x = 9; { val x = 3 } }")
    x.scope.exists("x").should.eql true
    x.code[1].scope.exists("x").should.eql true
    test_util.stateToPos(x.scope.get("x")).should.eql(number: "base10", value: "9", pos: [ 10, 11 ])
    test_util.stateToPos(x.code[1].scope.get("x")).should.eql(number: "base10", value: "3", pos: [ 23, 24 ])
