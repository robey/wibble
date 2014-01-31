util = require 'util'
object = require './object'
r_type = require './r_type'
builtins = require '../transform/builtins'

TSymbol = r_type.nativeType builtins.DSymbol,
  create: (name) ->
    obj = new object.WObject(TSymbol)
    obj.native.name = name
    obj

  init: ->

  ":repr": (target) -> ".#{target.native.name}"

  ":equals": (target, other) ->
    if other.type != TSymbol then return false
    target.native.name == other.native.name


exports.TSymbol = TSymbol
