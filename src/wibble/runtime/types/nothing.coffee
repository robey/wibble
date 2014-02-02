util = require 'util'
object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'

TNothing = r_type.nativeType transform.DNothing,
  create: ->
    if @singleton? then return @singleton
    @singleton = new object.WObject(TNothing)
    @singleton

  init: ->
    @on "hit", (target, message) =>
      console.log "Nothing happens."
      target

  ":repr": (target) -> "()"

  ":equals": (target, other) ->
    if other.type != TNothing then return false
    true


exports.TNothing = TNothing
