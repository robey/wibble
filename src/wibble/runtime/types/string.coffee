util = require 'util'
int = require './int'
misc = require '../../misc'
object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'

TString = r_type.nativeType transform.DString,
  create: (value) ->
    obj = new object.WObject(@)
    obj.native.value = value
    obj

  init: ->
    @on "size", null, (target, message) => int.TInt.create(target.native.value.length)

  ":inspect": (target) -> '"' + misc.cstring(target.native.value) + '"'

  ":equals": (target, other) ->
    if other.type != TString then return false
    target.native.value == other.native.value


exports.TString = TString
