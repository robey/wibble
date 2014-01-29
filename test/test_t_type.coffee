should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
t_type = require "#{wibble}/transform/t_type"
builtins = require "#{wibble}/transform/builtins"
test_util = require './test_util'

describe "TypeDescriptor", ->
  it "named type equality", ->
    new t_type.NamedType("House").equals(new t_type.NamedType("House")).should.eql true
    new t_type.NamedType("House").equals(new t_type.NamedType("Cat")).should.eql false

  it "function type equality", ->
    f1 = new t_type.FunctionType(builtins.DInt, builtins.DSymbol)
    f2 = new t_type.FunctionType(builtins.DString, builtins.DSymbol)
    f3 = new t_type.FunctionType(builtins.DInt, builtins.DSymbol)
    f1.equals(f2).should.eql false
    f1.equals(f3).should.eql true

  it "compound type equality", ->
    xInt = { name: "x", type: builtins.DInt }
    nameString = { name: "name", type: builtins.DString }
    s1 = new t_type.CompoundType([ xInt, nameString ])
    s2 = new t_type.CompoundType([ nameString, xInt ])
    s3 = new t_type.CompoundType([ xInt ])
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
      builtins.DString.canCoerceFrom(builtins.DString).should.eql true
      builtins.DInt.canCoerceFrom(builtins.DSymbol).should.eql false
      builtins.DAny.canCoerceFrom(builtins.DString).should.eql true

    it "structs", ->
      xInt = { name: "x", type: builtins.DInt }
      nameString = { name: "name", type: builtins.DString }
      s1 = new t_type.CompoundType([ xInt, nameString ])
      s2 = new t_type.CompoundType([ nameString, xInt ])
      s3 = new t_type.CompoundType([ xInt ])
      new t_type.CompoundType([]).canCoerceFrom(builtins.DNothing).should.eql true
      s3.canCoerceFrom(builtins.DInt).should.eql true
      s3.canCoerceFrom(s2).should.eql false
      s1.canCoerceFrom(s2).should.eql true
      s2.canCoerceFrom(s1).should.eql true

  describe "buildType", ->
    parse = (line, options) -> parser.typedecl.run(line, options)
    build = (line, options) -> t_type.buildType(parse(line, options))

    it "simple", ->
      build("()").toRepr().should.eql "()"
      build("Nothing").toRepr().should.eql "Nothing"

    it "compound", ->
      build("(x: Int, y: Int)").toRepr().should.eql "(x: Int, y: Int)"
      build("(x: Int, y: Int = 3)").toRepr().should.eql "(x: Int, y: Int = 3)"

    it "function", ->
      build("Int -> String").toRepr().should.eql "Int -> String"

  it "findType", ->
    parse = (line, options) -> parser.typedecl.run(line, options)
    find = (line, options) -> t_type.findType(parse(line, options), builtins.typemap)
    find("Int").should.eql builtins.DInt
    find("String -> Int").should.eql new t_type.FunctionType(builtins.DString, builtins.DInt)
    find("(x: Int, y: Int)").should.eql new t_type.CompoundType([
      { name: "x", type: builtins.DInt, value: undefined }
      { name: "y", type: builtins.DInt, value: undefined }
    ])
