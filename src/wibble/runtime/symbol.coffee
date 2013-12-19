object = require './object'
types = require './types'

class WSymbol extends object.WObject
  constructor: (@name) ->
    super(types.WSymbolType)

  tpRepr: -> ".#{@name}"

  equals: (other) -> other.type == types.WSymbolType and (other.name == @name)


exports.WSymbol = WSymbol
