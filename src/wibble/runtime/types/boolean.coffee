util = require 'util'
object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'

TBoolean = r_type.nativeType transform.DBoolean,
  create: (value) ->
    obj = new object.WObject(@)
    obj.native.value = value
    obj

  init: ->
    @on "not", null, (target, message) => @create(not target.native.value)

  ":inspect": (target) -> if target.native.value then "true" else "false"

  ":equals": (target, other) ->
    if other.type != TBoolean then return false
    target.native.value == other.native.value


exports.TBoolean = TBoolean
