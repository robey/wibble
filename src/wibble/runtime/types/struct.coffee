util = require 'util'
object = require '../object'
r_type = require '../r_type'

class TStruct extends r_type.Type
  constructor: (descriptor) ->
    super(descriptor)

  create: (values) ->
    obj = new object.WObject(@)
    for k, v of values then obj.scope.set(k, v)
    obj

  init: ->
    # accessors
    for field in @descriptor.fields then do (field) =>
      @on field.name, (target, message) -> target.scope.get(field.name)

  coerce: (other) ->
    nothing = require './nothing'
    otherFields =
      if other.type == nothing.TNothing
        []
      else if other.type instanceof TStruct
        other.scope.keys().map (k) -> { name: k, value: other.scope.get(k) }
      else
        [ { name: "?0", value: other } ]
    values = {}
    for f in otherFields 
      name = if f.name[0] == "?" then @descriptor.fields[parseInt(f.name[1...])].name else f.name
      values[name] = f.value
    # fill in default values:
    for f in @descriptor.fields when not values[f.name]? then values[f.name] = f.value
    @create(values)

  ":repr": (target) ->
    fields = target.scope.keys().map (k) -> "#{k} = #{target.scope.get(k).toRepr()}"
    "(#{fields.join ', '})"

  ":equals": (target, other) ->
    return false unless (other.type.equals(target.type))
    for k in target.scope.keys()
      if not other.scope.get(k).equals(target.scope.get(k)) then return false
    true


exports.TStruct = TStruct
