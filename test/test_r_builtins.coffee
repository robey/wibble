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
    it "inspect", ->
      types.TBoolean.create(true).inspect().should.eql "true"
      types.TBoolean.create(false).inspect().should.eql "false"

    it "equals", ->
      t = types.TBoolean.create(true)
      f = types.TBoolean.create(false)
      types.TBoolean[":equals"](t, t).should.equal true
      types.TBoolean[":equals"](t, f).should.equal false

  describe "Int", ->
    i5 = types.TInt.create("5")
    i23 = types.TInt.create("23")
    i9k = types.TInt.create("9000")

    it "inspect", ->
      i23.inspect().should.eql "23"

    it "basic math", ->
      callNative(i23, "+", i9k).inspect().should.eql "9023"
      callNative(i9k, "-", i23).inspect().should.eql "8977"
      callNative(i23, "-", i5).inspect().should.eql "18"
      callNative(i5, "-", i23).inspect().should.eql "-18"
      callNative(i5, "*", i23).inspect().should.eql "115"
      callNative(i23, "/", i5).inspect().should.eql "4"
      callNative(i23, "%", i5).inspect().should.eql "3"
      callNative(i9k, "positive").inspect().should.eql "9000"
      callNative(i9k, "negative").inspect().should.eql "-9000"

    it "comparisons", ->
      callNative(i23, "==", i5).inspect().should.eql "false"
      callNative(i23, "==", i23).inspect().should.eql "true"
      callNative(i23, "!=", i5).inspect().should.eql "true"
      callNative(i23, "!=", i23).inspect().should.eql "false"
      callNative(i23, "<", i5).inspect().should.eql "false"
      callNative(i5, "<", i23).inspect().should.eql "true"
      callNative(i23, ">", i5).inspect().should.eql "true"
      callNative(i5, ">", i23).inspect().should.eql "false"
      callNative(i23, "<=", i5).inspect().should.eql "false"
      callNative(i23, "<=", i23).inspect().should.eql "true"
      callNative(i5, "<=", i23).inspect().should.eql "true"
      callNative(i23, ">=", i5).inspect().should.eql "true"
      callNative(i23, ">=", i23).inspect().should.eql "true"
      callNative(i5, ">=", i23).inspect().should.eql "false"

    it "power", ->
      i2 = types.TInt.create("2")
      i3 = types.TInt.create("3")
      callNative(i2, "**", i3).inspect().should.eql "8"
      callNative(i3, "**", i2).inspect().should.eql "9"
      callNative(i23, ">>", i3).inspect().should.eql "2"
      callNative(i9k, ">>", i5).inspect().should.eql "281"
      callNative(i9k, "<<", i5).inspect().should.eql "288000"

    it "equals", ->
      i17 = callNative(i23, "-", i5)
      x = callNative(i17, "+", i5)
      types.TInt[":equals"](x, i23).should.eql true
      types.TInt[":equals"](i17, i23).should.eql false

  describe "Nothing", ->
    it "inspect", ->
      types.TNothing.create().inspect().should.eql "()"

    it "equals", ->
      types.TNothing[":equals"](types.TNothing.create(), types.TNothing.create()).should.eql true

  describe "Struct", ->
    tEmpty = new types.TStruct(new t_type.CompoundType([]))
    tSingleInt = new types.TStruct(new t_type.CompoundType([ { name: "n", type: descriptors.DInt } ]))
    dPoint = new t_type.CompoundType([ { name: "x", type: descriptors.DInt }, { name: "y", type: descriptors.DInt } ])
    tPoint = new types.TStruct(dPoint)
    dPointDefaults = new t_type.CompoundType([
      { name: "x", type: descriptors.DInt, value: types.TInt.create("1") }
      { name: "y", type: descriptors.DInt, value: types.TInt.create("2") }
    ])
    tPointDefaults = new types.TStruct(dPointDefaults)
    i10 = types.TInt.create("10")
    i20 = types.TInt.create("20")
    i30 = types.TInt.create("30")
    p1020 = tPoint.create(x: i10, y: i20)
    p1030 = tPoint.create(x: i10, y: i30)
    # Point with fields reversed
    trPoint = new types.TStruct(new t_type.CompoundType([ dPoint.fields[1], dPoint.fields[0] ]))
    rp1030 = trPoint.create(y: i30, x: i10)

    it "inspect", ->
      p1020.inspect().should.eql("(x = 10, y = 20)")

    it "equals", ->
      tPoint[":equals"](p1020, p1020).should.eql true
      tPoint[":equals"](p1020, p1030).should.eql false
      tPoint[":equals"](p1020, tPoint.create(x: i10, y: i20)).should.eql true
      # order of the fields shouldn't matter
      tPoint[":equals"](p1030, rp1030).should.eql true

    it "coerce", ->
      tEmpty.coerce(types.TNothing.create()).inspect().should.eql("()")
      tSingleInt.coerce(types.TInt.create("99")).inspect().should.eql("(n = 99)")
      tPoint.coerce(p1020).inspect().should.eql("(x = 10, y = 20)")
      tPoint.coerce(rp1030).inspect().should.eql("(x = 10, y = 30)")
      tPoint.coerce(rp1030).type.inspect().should.eql tPoint.inspect()

    it "coerce with defaults", ->
      tPointDefaults.coerce(types.TNothing.create()).inspect().should.eql("(x = 1, y = 2)")
      tPointDefaults.coerce(types.TInt.create(5)).inspect().should.eql("(x = 5, y = 2)")

    it "coerce nested structs", ->
      defaultPoint = tPointDefaults.create(x: types.TInt.create("1"), y: types.TInt.create("2"))
      tNested = new types.TStruct(new t_type.CompoundType([ { name: "point", type: dPointDefaults, value: defaultPoint } ]))
      tNested.coerce(types.TNothing.create()).inspect().should.eql("(point = (x = 1, y = 2))")
      tNested.coerce(tPointDefaults.create(x: types.TInt.create("10"))).inspect().should.eql("(point = (x = 10, y = 2))")

    it "accessors", ->
      callNative(p1020, "x").inspect().should.eql "10"
      callNative(p1020, "y").inspect().should.eql "20"

    it "copy", ->
      # FIXME

  describe "Symbol", ->
    it "inspect", ->
      types.TSymbol.create("house").inspect().should.eql ".house"

    it "equals", ->
      types.TSymbol[":equals"](types.TSymbol.create("house"), types.TSymbol.create("house")).should.eql true
      types.TSymbol[":equals"](types.TSymbol.create("house"), types.TSymbol.create("cat")).should.eql false

