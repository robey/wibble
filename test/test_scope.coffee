should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
scope = require "#{wibble}/runtime/r_scope"
test_util = require './test_util'

describe "Scope", ->
  it "is set locally", ->
    s = new scope.Scope()
    s.setNew("x", 12)
    s.get("x").should.eql(12)

  it "finds chained values", ->
    s = new scope.Scope()
    s.setNew("x", 12)
    s2 = new scope.Scope(s)
    s2.get("x").should.eql(12)

  it "overwrites chained values", ->
    s = new scope.Scope()
    s.setNew("x", 12)
    s2 = new scope.Scope(s)
    s2.set("x", 13)
    s2.get("x").should.eql(13)
    s.get("x").should.eql(13)
