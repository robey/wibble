util = require 'util'
bigint = require 'big-integer'
boolean = require './boolean'
object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'

fromHex = (s) ->
  rv = bigint("0")
  for ch in s then rv = rv.multiply(16).add(parseInt(ch, 16))
  rv

fromBin = (s) ->
  rv = bigint("0")
  for ch in s then rv = rv.multiply(2).add(if ch == "1" then 1 else 0)
  rv

TInt = r_type.nativeType transform.DInt,
  create: (value, base = 10) ->
    obj = new object.WObject(TInt)
    if base == 16 then value = fromHex(value)
    if base == 2 then value = fromBin(value)
    obj.native.value = if value instanceof bigint then value else bigint(value, base)
    obj

  init: ->
    @nativeMethod "+", (target, message) => @create(target.native.value.add(message.native.value))
    @nativeMethod "-", (target, message) => @create(target.native.value.subtract(message.native.value))
    @nativeMethod "*", (target, message) => @create(target.native.value.multiply(message.native.value))
    @nativeMethod "/", (target, message) => @create(target.native.value.divide(message.native.value))
    @nativeMethod "%", (target, message) => @create(target.native.value.mod(message.native.value))
    # these two are sad.
    @nativeMethod "<<", (target, message) => @create(target.native.value.multiply(bigint("2").pow(message.native.value)))
    @nativeMethod ">>", (target, message) => @create(target.native.value.divide(bigint("2").pow(message.native.value)))
    @on "positive", null, (target, message) => target
    @on "negative", null, (target, message) => @create(target.native.value.negate())
    @nativeMethod "==", (target, message) => boolean.TBoolean.create(target.native.value.equals(message.native.value))
    @nativeMethod "!=", (target, message) => boolean.TBoolean.create(not target.native.value.equals(message.native.value))
    @nativeMethod "<", (target, message) => boolean.TBoolean.create(target.native.value.lesser(message.native.value))
    @nativeMethod ">", (target, message) => boolean.TBoolean.create(target.native.value.greater(message.native.value))
    @nativeMethod "<=", (target, message) => boolean.TBoolean.create(target.native.value.lesserOrEquals(message.native.value))
    @nativeMethod ">=", (target, message) => boolean.TBoolean.create(target.native.value.greaterOrEquals(message.native.value))
    @nativeMethod "**", (target, message) => @create(target.native.value.pow(message.native.value))

  ":repr": (target) -> target.native.value.toString()

  ":equals": (target, other) ->
    if other.type != TInt then return false
    target.native.value.equals(other.native.value)


exports.TInt = TInt
