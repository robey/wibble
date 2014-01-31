should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
builtins = require "#{wibble}/transform/builtins"
int = require "#{wibble}/runtime/int"
object = require "#{wibble}/runtime/object"
r_type = require "#{wibble}/runtime/r_type"
symbol = require "#{wibble}/runtime/symbol"
t_type = require "#{wibble}/transform/t_type"

parser = require "#{wibble}/parser"
test_util = require './test_util'

describe "Runtime type", ->
  dToaster = new t_type.NamedType("Toaster")
  t_type.addHandlers dToaster, builtins.typemap,
    ".size": "Int"
  tToaster = r_type.nativeType dToaster,
    create: -> new object.WObject(tToaster)
    init: ->
      @on "size", (target, message) => int.TInt.create(target.native.size.toString())


  it "builds a native type", ->
    tToaster.toRepr().should.eql "Toaster"
    tToaster.equals(tToaster).should.eql true
    tToaster.equals(int.TInt).should.eql false

  it "can create objects", ->
    obj = tToaster.create()
    obj.type.toRepr().should.eql "Toaster"

  it "finds & calls message handlers", ->
    h = tToaster.handlerForMessage(symbol.TSymbol.create("destroy"))
    (h?).should.eql false
    h = tToaster.handlerForMessage(symbol.TSymbol.create("size"))
    (h?).should.eql true
    obj = tToaster.create()
    obj.native.size = 123
    rv = h.expr(obj, symbol.TSymbol.create("size"))
    rv.toRepr().should.eql "123"
