util = require 'util'
bigint = require 'big-integer'
object = require '../object'
r_type = require '../r_type'
descriptors = require '../../transform/descriptors'


TInt = r_type.nativeType descriptors.DInt,
  create: (value, base = 10) ->
    obj = new object.WObject(TInt)
    # FIXME i don't think big-integer supports bases.
    obj.native.value = if value instanceof bigint then value else bigint(value, base)
    obj

  init: ->
    @nativeMethod "+", (target, message) => @create(target.native.value.add(message.native.value))
    @nativeMethod "-", (target, message) => @create(target.native.value.subtract(message.native.value))
    @nativeMethod "*", (target, message) => @create(target.native.value.multiply(message.native.value))
    @nativeMethod "/", (target, message) => @create(target.native.value.divide(message.native.value))
    @nativeMethod "%", (target, message) => @create(target.native.value.mod(message.native.value))
    @nativeMethod "positive", (target, message) => target
    @nativeMethod "negative", (target, message) => @create(target.native.value.negate())

  ":repr": (target) -> target.native.value.toString()

  ":equals": (target, other) ->
    if other.type != TInt then return false
    target.native.value.equals(other.native.value)


exports.TInt = TInt
