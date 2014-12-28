object = require '../object'
r_type = require '../r_type'
transform = require '../../transform'
util = require 'util'

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
    for field in @descriptor.fields then values[field.name] = field.value

    switch @descriptor.coercionKind(other.type.descriptor)
      # do nothing for "nothing"
      when "single"
        field = @descriptor.fields[0]
        values[field.name] = other
      when "compound"
        for key in other.state.keys()
          field = @descriptor.fieldByName(key)
          value = other.state.get(key)
          # FIXME: is this really specific to nested structs? seems like it should be more generic.
          if field.type instanceof transform.CompoundType
            value = new TStruct(field.type).coerce(value)
          values[field.name] = value
      when "nested"
        field = @descriptor.fields[0]
        values[field.name] = new TStruct(field.type).coerce(other)
    @create(values)

  ":inspect": (target) ->
    fields = target.state.keys().map (k) -> "#{k} = #{target.state.get(k).inspect()}"
    "(#{fields.join ', '})"

  ":equals": (target, other) ->
    return false unless (other.type.equals(target.type))
    for k in target.state.keys()
      if not other.state.get(k).equals(target.state.get(k)) then return false
    true


exports.TStruct = TStruct
