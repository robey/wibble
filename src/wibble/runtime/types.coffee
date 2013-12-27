util = require 'util'
object = require './object'

class WType extends object.WObject
  constructor: (@name) ->
    super(WTypeType)

  toRepr: -> @name

  equals: (other) -> @ == other

  # the only legal coercion is to Any
  canCoerceTo: (other) ->
    @equals(other) or (other == WAnyType)


WTypeType = new WType("Type")
WTypeType.handlerForMessage = (message) ->
  # need to cut off recursive lookups here.
  null

WNothingType = new WType("Nothing")
WAnyType = new WType("Any")
WIntType = new WType("Int")
WSymbolType = new WType("Symbol")
WStringType = new WType("String")

class WFunctionType extends WType
  constructor: (@inType, @outType) ->
    super("#{@inType.name} -> #{@outType.name}")

  equals: (other) ->
    (other instanceof WFunctionType) and (@inType.equals other.inType) and (@outType.equals other.outType)


exports.WAnyType = WAnyType
exports.WFunctionType = WFunctionType
exports.WIntType = WIntType
exports.WNothingType = WNothingType
exports.WStringType = WStringType
exports.WSymbolType = WSymbolType
exports.WType = WType
exports.WTypeType = WTypeType
