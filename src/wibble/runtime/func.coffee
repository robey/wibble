object = require './object'
types = require './types'

class WFunction extends object.WObject
  constructor: (type, state, @body) ->
    super(type, state)

  toRepr: -> @body


exports.WFunction = WFunction
