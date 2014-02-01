should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
int = require "#{wibble}/runtime/int"
test_util = require './test_util'

describe "Runtime builtin types", ->
  describe "Int", ->
    it "repr", ->
      int.TInt.create("23").toRepr().should.eql "23"
