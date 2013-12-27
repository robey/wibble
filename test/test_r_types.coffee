should = require 'should'
util = require 'util'

wibble = "../lib/wibble"

types = require "#{wibble}/runtime/types"
test_util = require './test_util'

describe "Runtime types", ->
  it "singleton type equality", ->
    types.WTypeType.equals(types.WTypeType).should.eql true
    types.WIntType.equals(types.WSymbolType).should.eql false

  it "function type equality", ->
    f1 = new types.WFunctionType(types.WIntType, types.WSymbolType)
    f2 = new types.WFunctionType(types.WStringType, types.WSymbolType)
    f3 = new types.WFunctionType(types.WIntType, types.WSymbolType)
    f1.equals(f2).should.eql false
    f1.equals(f3).should.eql true

  it "can coerce to other types", ->
    types.WTypeType.canCoerceTo(types.WTypeType).should.eql true
    types.WStringType.canCoerceTo(types.WSymbolType).should.eql false
    types.WStringType.canCoerceTo(types.WAnyType).should.eql true
