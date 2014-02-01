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
    if @descriptor.fields.length == 0 then return @create({})
    values = {}
    if @descriptor.fields.length == 1
      values[@descriptor.fields[0].name] = other
      return @create(values)
    for k in other.scope.keys()
      v = other.scope.get(k)
      if k[0] == "?" then k = @descriptor.fields[parseInt(k[1...])].name
      values[k] = v
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
