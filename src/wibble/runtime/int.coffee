bigint = require 'bigint'
object = require './object'
types = require './types'

class WInt extends object.WObject
  constructor: (value, base) ->
    super(types.WIntType)
    @value = bigint(value, base)

  toDebug: -> @value.toString()

  equals: (other) ->
    (other instanceof WInt) and (other.value.eq(@value))


exports.WInt = WInt
