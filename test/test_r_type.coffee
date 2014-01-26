should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
r_type = require "#{wibble}/runtime/r_type"
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

  it "struct type equality", ->
    xInt = new types.WField("x", types.WIntType)
    nameString = new types.WField("name", types.WStringType)
    s1 = new types.WStructType([ xInt, nameString ])
    s2 = new types.WStructType([ nameString, xInt ])
    s3 = new types.WStructType([ xInt ])
    s1.equals(s1).should.eql true
    s1.equals(s2).should.eql true
    s1.equals(s3).should.eql false
    s2.equals(s1).should.eql true
    s2.equals(s2).should.eql true
    s2.equals(s3).should.eql false
    s3.equals(s1).should.eql false
    s3.equals(s2).should.eql false
    s3.equals(s3).should.eql true

  describe "can coerce to other types", ->
    it "simple", ->
      types.WTypeType.canCoerceFrom(types.WTypeType).should.eql true
      types.WStringType.canCoerceFrom(types.WSymbolType).should.eql false
      types.WAnyType.canCoerceFrom(types.WStringType).should.eql true

    it "structs", ->
      xInt = new types.WField("x", types.WIntType)
      nameString = new types.WField("name", types.WStringType)
      s1 = new types.WStructType([ xInt, nameString ])
      s2 = new types.WStructType([ nameString, xInt ])
      s3 = new types.WStructType([ xInt ])
      new types.WStructType().canCoerceFrom(types.WNothingType).should.eql true
      s3.canCoerceFrom(types.WIntType).should.eql true
      s3.canCoerceFrom(s2).should.eql false
      s1.canCoerceFrom(s2).should.eql true
      s2.canCoerceFrom(s1).should.eql true

  describe "evalType", ->
    parse = (line, options) -> parser.typedecl.run(line, options)
    evalType = (s, typeMap) -> r_type.evalType(parse(s), typeMap)

    it "can find builtins", ->
      evalType("Int").should.eql types.WIntType
      evalType("Widget", Widget: types.WStringType).should.eql types.WStringType

    it "can build compound types", ->
      t = evalType("(x: Int, y: Int)")
      t.equals(new types.WStructType([ new types.WField("x", types.WIntType), new types.WField("y", types.WIntType) ])).should.eql true

    it "can build functions", ->
      t = evalType("Symbol -> Int")
      t.equals(new types.WFunctionType(types.WSymbolType, types.WIntType)).should.eql true
