should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
descriptors = require "#{wibble}/transform/descriptors"
t_type = require "#{wibble}/transform/t_type"
types = require "#{wibble}/runtime/types"
test_util = require './test_util'

describe "Runtime builtin types", ->
  callNative = (obj, message...) ->
    m = message.shift()
    if typeof m == "string" then m = types.TSymbol.create(m)
    rv = obj.type.handlerForMessage(m).expr(obj, m)
    if message.length == 0 then return rv
    callNative rv, message...

  describe "Boolean", ->
    it "repr", ->
      types.TBoolean.create(true).toRepr().should.eql "true"
      types.TBoolean.create(false).toRepr().should.eql "false"

    it "equals", ->
      t = types.TBoolean.create(true)
      f = types.TBoolean.create(false)
      types.TBoolean[":equals"](t, t).should.equal true
      types.TBoolean[":equals"](t, f).should.equal false

  describe "Int", ->
    i5 = types.TInt.create("5")
    i23 = types.TInt.create("23")
    i9k = types.TInt.create("9000")

    it "repr", ->
      i23.toRepr().should.eql "23"

    it "basic math", ->
      callNative(i23, "+", i9k).toRepr().should.eql "9023"
      callNative(i9k, "-", i23).toRepr().should.eql "8977"
      callNative(i23, "-", i5).toRepr().should.eql "18"
      callNative(i5, "-", i23).toRepr().should.eql "-18"
      callNative(i5, "*", i23).toRepr().should.eql "115"
      callNative(i23, "/", i5).toRepr().should.eql "4"
      callNative(i23, "%", i5).toRepr().should.eql "3"
      callNative(i9k, "positive", types.TNothing.create()).toRepr().should.eql "9000"
      callNative(i9k, "negative", types.TNothing.create()).toRepr().should.eql "-9000"

    it "equals", ->
      i17 = callNative(i23, "-", i5)
      x = callNative(i17, "+", i5)
      types.TInt[":equals"](x, i23).should.eql true
      types.TInt[":equals"](i17, i23).should.eql false

  describe "Nothing", ->
    it "repr", ->
      types.TNothing.create().toRepr().should.eql "()"

    it "equals", ->
      types.TNothing[":equals"](types.TNothing.create(), types.TNothing.create()).should.eql true

  describe "Struct", ->
    tEmpty = new types.TStruct(new t_type.CompoundType([]))
    tSingleInt = new types.TStruct(new t_type.CompoundType([ { name: "n", type: descriptors.DInt } ]))
    dPoint = new t_type.CompoundType([ { name: "x", type: descriptors.DInt }, { name: "y", type: descriptors.DInt } ])
    tPoint = new types.TStruct(dPoint)
    i10 = types.TInt.create("10")
    i20 = types.TInt.create("20")
    i30 = types.TInt.create("30")
    p1020 = tPoint.create(x: i10, y: i20)
    p1030 = tPoint.create(x: i10, y: i30)
    # Point with fields reversed
    trPoint = new types.TStruct(new t_type.CompoundType([ dPoint.fields[1], dPoint.fields[0] ]))
    rp1030 = trPoint.create(y: i30, x: i10)

    it "repr", ->
      p1020.toRepr().should.eql("(x = 10, y = 20)")

    it "equals", ->
      tPoint[":equals"](p1020, p1020).should.eql true
      tPoint[":equals"](p1020, p1030).should.eql false
      tPoint[":equals"](p1020, tPoint.create(x: i10, y: i20)).should.eql true
      # order of the fields shouldn't matter
      tPoint[":equals"](p1030, rp1030).should.eql true

    it "coerce", ->
      tEmpty.coerce(types.TNothing.create()).toRepr().should.eql("()")
      tSingleInt.coerce(types.TInt.create("99")).toRepr().should.eql("(n = 99)")
      tPoint.coerce(p1020).toRepr().should.eql("(x = 10, y = 20)")
      tPoint.coerce(rp1030).toRepr().should.eql("(x = 10, y = 30)")
      tPoint.coerce(rp1030).type.toRepr().should.eql tPoint.toRepr()

    it "coerce with defaults", ->
      dPoint = new t_type.CompoundType([
        { name: "x", type: descriptors.DInt, value: types.TInt.create("1") }
        { name: "y", type: descriptors.DInt, value: types.TInt.create("2") }
      ])
      tPoint = new types.TStruct(dPoint)
      tPoint.coerce(types.TNothing.create()).toRepr().should.eql("(x = 1, y = 2)")
      tPoint.coerce(types.TInt.create(5)).toRepr().should.eql("(x = 5, y = 2)")

    it "accessors", ->
      callNative(p1020, "x").toRepr().should.eql "10"
      callNative(p1020, "y").toRepr().should.eql "20"

    it "copy", ->
      # FIXME

  describe "Symbol", ->
    it "repr", ->
      types.TSymbol.create("house").toRepr().should.eql ".house"

    it "equals", ->
      types.TSymbol[":equals"](types.TSymbol.create("house"), types.TSymbol.create("house")).should.eql true
      types.TSymbol[":equals"](types.TSymbol.create("house"), types.TSymbol.create("cat")).should.eql false

