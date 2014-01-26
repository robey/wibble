object = require './object'
types = require './types'

class WStruct extends object.WObject
  constructor: (@type, @values) ->
    super(@type)

  toRepr: ->
    "(" + (@type.fields.filter((f) - @values[f.name]?).map (f) -> f.name + " = " + @values[f.name]).join(", ") + ")"

  equals: (other) ->
    return false unless (other.type.equals(@type))
    for k, v of @values then if not other.values[k].equals(v) then return false
    true


exports.WStruct = WStruct
