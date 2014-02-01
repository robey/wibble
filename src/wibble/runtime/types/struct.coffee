util = require 'util'
object = require '../object'
r_type = require '../r_type'

class TStruct extends r_type.Type
  constructor: (descriptor) ->
    super(descriptor)

  create: -> # FIXME

  init: -> # FIXME

  ":repr": (target) ->
    fields = target.scope.keys().map (k) -> "#{k} = #{target.scope.get(k).toRepr()}"
    "(#{fields.join ', '})"

  ":equals": (target, other) ->
    return false unless (other.type.equals(target.type))
    for k in target.scope.keys
      if not other.scope.get(k).equals(target.scope.get(k)) then return false
    true


exports.TStruct = TStruct
