object = require './object'
types = require './types'

# this may be the smallest file in wibble. :)
WNothing = new object.WObject(types.WNothingType)
WNothing.toRepr = -> "()"
WNothing.equals = (other) -> other == WNothing


exports.WNothing = WNothing
