boolean = require './boolean'
int = require './int'
misc = require '../../misc'
object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'
util = require 'util'

TString = r_type.nativeType transform.DString,
  create: (value) ->
    obj = new object.WObject(@)
    obj.native.value = value
    obj

  init: ->
    @on "size", null, (target, message) => int.TInt.create(target.native.value.length)
    @nativeMethod "==", (target, message) => boolean.TBoolean.create(target.native.value == message.native.value)
    @nativeMethod "!=", (target, message) => boolean.TBoolean.create(target.native.value != message.native.value)

  ":inspect": (target) -> '"' + misc.cstring(target.native.value) + '"'

  ":equals": (target, other) ->
    if other.type != TString then return false
    target.native.value == other.native.value


exports.TString = TString
