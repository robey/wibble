should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
parser = require "#{wibble}/parser"
t_type = require "#{wibble}/transform/t_type"
descriptors = require "#{wibble}/transform/descriptors"
test_util = require './test_util'

describe "TypeDescriptor", ->
  it "named type equality", ->
    new t_type.NamedType("House").equals(new t_type.NamedType("House")).should.eql true
    new t_type.NamedType("House").equals(new t_type.NamedType("Cat")).should.eql false

  it "function type equality", ->
    f1 = new t_type.FunctionType(descriptors.DInt, descriptors.DSymbol)
    f2 = new t_type.FunctionType(descriptors.DString, descriptors.DSymbol)
    f3 = new t_type.FunctionType(descriptors.DInt, descriptors.DSymbol)
    f1.equals(f2).should.eql false
    f1.equals(f3).should.eql true

  it "compound type equality", ->
    xInt = { name: "x", type: descriptors.DInt }
    nameString = { name: "name", type: descriptors.DString }
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

  it "compound type accessors", ->
    xInt = { name: "x", type: descriptors.DInt }
    nameString = { name: "name", type: descriptors.DString }
    s1 = new t_type.CompoundType([ xInt, nameString ])
    s1.handlerTypeForMessage(null, "x").should.eql descriptors.DInt
    s1.handlerTypeForMessage(null, "name").should.eql descriptors.DString
    s1.handlerTypeForMessage(null, "missing").should.eql descriptors.DAny

  describe "can coerce to other types", ->
    it "simple", ->
      descriptors.DString.canCoerceFrom(descriptors.DString).should.eql true
      descriptors.DInt.canCoerceFrom(descriptors.DSymbol).should.eql false
      descriptors.DAny.canCoerceFrom(descriptors.DString).should.eql true

    it "structs", ->
      xInt = { name: "x", type: descriptors.DInt }
      nameString = { name: "name", type: descriptors.DString }
      s1 = new t_type.CompoundType([ xInt, nameString ])
      s2 = new t_type.CompoundType([ nameString, xInt ])
      s3 = new t_type.CompoundType([ xInt ])
      new t_type.CompoundType([]).canCoerceFrom(descriptors.DNothing).should.eql true
      s3.canCoerceFrom(descriptors.DInt).should.eql true
      s3.canCoerceFrom(s2).should.eql false
      s1.canCoerceFrom(s2).should.eql true
      s2.canCoerceFrom(s1).should.eql true

    it "structs with positionals", ->
      xInt = { name: "x", type: descriptors.DInt }
      nameString = { name: "name", type: descriptors.DString }
      s1 = new t_type.CompoundType([ xInt, nameString ])
      s2 = new t_type.CompoundType([ { name: "?0", type: descriptors.DInt }, { name: "?1", type: descriptors.DString } ])      
      s3 = new t_type.CompoundType([ { name: "?0", type: descriptors.DSymbol }, { name: "?1", type: descriptors.DString } ])      
      s1.canCoerceFrom(s2).should.eql true
      s1.canCoerceFrom(s3).should.eql false

    it "structs with missing fields", ->
      s1 = new t_type.CompoundType([
        { name: "x", type: descriptors.DInt }
        { name: "name", type: descriptors.DString }
        { name: "valid", type: descriptors.DBoolean, value: { boolean: true } }
        { name: "wicket", type: descriptors.DInt }
      ])
      s2 = new t_type.CompoundType([
        { name: "?0", type: descriptors.DInt }
        { name: "wicket", type: descriptors.DInt }
        { name: "name", type: descriptors.DString }
      ])
      s3 = new t_type.CompoundType([
        { name: "?0", type: descriptors.DInt }
        { name: "name", type: descriptors.DString }
      ])
      s1.canCoerceFrom(s2).should.eql true
      s1.canCoerceFrom(s3).should.eql false
      s3.canCoerceFrom(s2).should.eql false

    it "structs with nothing", ->
      s1 = new t_type.CompoundType([
        { name: "height", type: descriptors.DInt, value: { number: "base10", value: "0" } }
        { name: "width", type: descriptors.DInt, value: { number: "base10", value: "0" } }
      ])
      s1.canCoerceFrom(descriptors.DNothing).should.eql true

    it "structs with single values", ->
      s1 = new t_type.CompoundType([
        { name: "height", type: descriptors.DInt, value: { number: "base10", value: "0" } }
        { name: "width", type: descriptors.DInt, value: { number: "base10", value: "0" } }
      ])
      s1.canCoerceFrom(descriptors.DInt).should.eql true
      s1.canCoerceFrom(descriptors.DString).should.eql false

  describe "buildType", ->
    parse = (line, options) -> parser.typedecl.run(line, options)
    build = (line, options) -> t_type.buildType(parse(line, options))

    it "simple", ->
      build("()").toRepr().should.eql "()"
      build("Nothing").toRepr().should.eql "Nothing"

    it "compound", ->
      build("(x: Int, y: Int)").toRepr().should.eql "(x: Int, y: Int)"
      build("(x: Int, y: Int = 3)").toRepr().should.eql "(x: Int, y: Int = 3)"
      (-> build("(x: Int, y: Int = 3, x: Symbol)")).should.throw /repeated/

    it "function", ->
      build("Int -> String").toRepr().should.eql "Int -> String"

    it "disjoint", ->
      build("String | Symbol").toRepr().should.eql "String | Symbol"

  describe "findType", ->
    parse = (line, options) -> parser.typedecl.run(line, options)
    find = (line, options) -> t_type.findType(parse(line, options), descriptors.typemap)

    it "simple", ->
      find("Int").should.eql descriptors.DInt

    it "compound", ->
      find("(x: Int, y: Int)").should.eql new t_type.CompoundType([
        { name: "x", type: descriptors.DInt, value: undefined }
        { name: "y", type: descriptors.DInt, value: undefined }
      ])

    it "functions", ->
      find("String -> Int").should.eql new t_type.FunctionType(descriptors.DString, descriptors.DInt)
      arg = new t_type.CompoundType([ { name: "s", type: descriptors.DString, value: undefined } ])
      find("(s: String) -> Int").should.eql new t_type.FunctionType(arg, descriptors.DInt)
      arg = new t_type.CompoundType([ { name: "s", type: descriptors.DAny, value: undefined } ])
      find("(s) -> Int").should.eql new t_type.FunctionType(arg, descriptors.DInt)

    it "disjoint", ->
      find("String | Symbol").should.eql new t_type.DisjointType([ descriptors.DString, descriptors.DSymbol ])
