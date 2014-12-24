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
    # fill in default values first.
    values = {}
    for f in @descriptor.fields then values[f.name] = f.value

    switch @descriptor.coercionKind(other.type.descriptor)
      when "single" then values[@descriptor.fields[0].name] = other
      when "compound"
        for key in other.state.keys()
          name = if key[0] == "?" then @descriptor.fields[parseInt(key[1...])].name else key
          values[name] = other.state.get(key)
      when "nested"
        nested = @descriptor.fields[0]
        values[nested.name] = new TStruct(nested.type).coerce(other)
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
