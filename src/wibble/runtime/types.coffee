object = require './object'

class WType extends object.WObject
  constructor: (@name) ->
    super(WTypeType)

  toRepr: -> @name

  equals: (other) -> @ == other

  # can 'otherType' be coerced to be this type?
  coerce: (otherType) -> otherType == @

  # can 'value' be coerced to be this type? if so, return a new value with
  # that coercion. otherwise return null.
  coerceValue: (value) ->
    if @ == value.type then return value
    null

WTypeType = new WType("Type")

WNothingType = new WType("Nothing")
WAnyType = new WType("Any")
WIntType = new WType("Int")
WSymbolType = new WType("Symbol")

class WFunctionType extends WType
  constructor: (@inType, @outType) ->
    super("#{@inType.name} -> #{@outType.name}")


exports.WAnyType = WAnyType
exports.WFunctionType = WFunctionType
exports.WIntType = WIntType
exports.WNothingType = WNothingType
exports.WSymbolType = WSymbolType
exports.WType = WType
exports.WTypeType = WTypeType
