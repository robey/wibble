util = require 'util'
object = require '../object'
r_type = require '../r_type'

class TStruct extends r_type.Type
  constructor: (descriptor) ->
    super(descriptor)

  create: (values) ->
    obj = new object.WObject(@)
    for k, v of values then obj.state.set(k, v)
    obj

  init: ->
    # accessors
    for field in @descriptor.fields then do (field) =>
      @on field.name, null, (target, message) -> target.state.get(field.name)

  coerce: (other) ->
    nothing = require './nothing'
    otherFields =
      if other.type == nothing.TNothing
        []
      else if other.type instanceof TStruct
        other.state.keys().map (k) -> { name: k, value: other.state.get(k) }
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
    fields = target.state.keys().map (k) -> "#{k} = #{target.state.get(k).toRepr()}"
    "(#{fields.join ', '})"

  ":equals": (target, other) ->
    return false unless (other.type.equals(target.type))
    for k in target.state.keys()
      if not other.state.get(k).equals(target.state.get(k)) then return false
    true


exports.TStruct = TStruct
