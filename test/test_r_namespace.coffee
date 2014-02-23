should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
r_namespace = require "#{wibble}/runtime/r_namespace"
test_util = require './test_util'

describe "Namespace", ->
  it "is set locally", ->
    s = new r_namespace.Namespace()
    s.set("x", 12)
    s.get("x").should.eql(12)

  it "finds chained values", ->
    s = new r_namespace.Namespace()
    s.set("x", 12)
    s2 = new r_namespace.Namespace(s)
    s2.get("x").should.eql(12)

  it "overwrites chained values", ->
    s = new r_namespace.Namespace()
    s.set("x", 12)
    s2 = new r_namespace.Namespace(s)
    s2.update("x", 13)
    s2.get("x").should.eql(13)
    s.get("x").should.eql(13)
