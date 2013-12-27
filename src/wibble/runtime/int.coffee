bigint = require 'bigint'
object = require './object'
types = require './types'

class WInt extends object.WObject
  constructor: (value, base) ->
    super(types.WIntType)
    @value = if value instanceof bigint then value else bigint(value, base)

  toRepr: -> @value.toString()

  equals: (other) ->
    (other instanceof WInt) and (other.value.eq(@value))

  add: (arg) -> new WInt(@value.add(arg.value))
  sub: (arg) -> new WInt(@value.sub(arg.value))
  mul: (arg) -> new WInt(@value.mul(arg.value))
  div: (arg) -> new WInt(@value.div(arg.value))
  mod: (arg) -> new WInt(@value.mod(arg.value))
  negative: -> new WInt(@value.neg())


types.WIntType.nativeMethod "+", types.WIntType, types.WIntType, (context, arg) -> context.add(arg)
types.WIntType.nativeMethod "-", types.WIntType, types.WIntType, (context, arg) -> context.sub(arg)
types.WIntType.nativeMethod "*", types.WIntType, types.WIntType, (context, arg) -> context.mul(arg)
types.WIntType.nativeMethod "/", types.WIntType, types.WIntType, (context, arg) -> context.div(arg)
types.WIntType.nativeMethod "%", types.WIntType, types.WIntType, (context, arg) -> context.mod(arg)
types.WIntType.nativeMethod "positive", types.WNothingType, types.WIntType, (context, arg) -> context
types.WIntType.nativeMethod "negative", types.WNothingType, types.WIntType, (context, arg) -> context.negative(arg)


exports.WInt = WInt
