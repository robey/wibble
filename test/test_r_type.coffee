should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
descriptors = require "#{wibble}/transform/descriptors"
types = require "#{wibble}/runtime/types"
object = require "#{wibble}/runtime/object"
r_type = require "#{wibble}/runtime/r_type"
t_type = require "#{wibble}/transform/t_type"

parser = require "#{wibble}/parser"
test_util = require './test_util'

describe "Runtime type", ->
  dToaster = new t_type.NamedType("Toaster")
  t_type.addHandlers dToaster, descriptors.typemap,
    ".size": "Int"
  tToaster = r_type.nativeType dToaster,
    create: -> new object.WObject(tToaster)
    init: ->
      @on "size", null, (target, message) => types.TInt.create(target.native.size.toString())


  it "builds a native type", ->
    tToaster.toRepr().should.eql "Toaster"
    tToaster.equals(tToaster).should.eql true
    tToaster.equals(types.TInt).should.eql false

  it "can create objects", ->
    obj = tToaster.create()
    obj.type.toRepr().should.eql "Toaster"

  it "finds & calls message handlers", ->
    h = tToaster.handlerForMessage(types.TSymbol.create("destroy"))
    (h?).should.eql false
    h = tToaster.handlerForMessage(types.TSymbol.create("size"))
    (h?).should.eql true
    obj = tToaster.create()
    obj.native.size = 123
    rv = h.expr(obj, types.TSymbol.create("size"))
    rv.toRepr().should.eql "123"
