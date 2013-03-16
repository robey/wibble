base = require("./runtime_base.coffee")
object = require("./object.coffee")

Handler = base.Handler
WObject = object.WObject


# ----- builtin types

class WType extends WObject
  constructor: (@name) ->
    super(WTypeType)

  toDebug: -> @name

  # can 'otherType' be coerced to be this type?
  coerce: (otherType) -> otherType == @

  # can 'value' be coerced to be this type? if so, return a new value with
  # that coercion. otherwise return null.
  coerceValue: (value) ->
    if @ == value.type then return value
    null

WTypeType = new WType("Type")

WUnitType = new WType("Unit")
WAnyType = new WType("Any")
WIntType = new WType("Int")
WSymbolType = new WType("Symbol")

class WField
  constructor: (@name, @type, @value) ->

  toDebug: ->
    @name + ": " + @type.toDebug() + (if @value? then (" = " + @value.toDebug()) else "")

class WStructType extends WType
  constructor: (@fields) ->
    super("Struct")
    @typeSymtab = {}
    for f in @fields then @typeSymtab[f.name] = f.type

  toDebug: ->
    "(" + @fields.map((f) -> f.toDebug()).join(", ") + ")"

  coerce: (otherType) ->
    if otherType == @ then return true
    # oh man.
    if @fields.length == 0 and otherType == types.WUnitType then return true
    if @fields.length == 1 and otherType == @fields[0].type then return true
    false

  coerceValue: (value) ->
    if @ == value.type then return value
    # oh man.
    if @fields.length == 0 and value.type == types.WUnitType
      return new WStruct(@, {})
    if @fields.length == 1 and value.type == @fields[0].type
      # odd bug in coffeescript syntax parser:
      x = {}
      x[@fields[0].name] = value
      return new WStruct(@, x)
    null

class WFunctionType extends WType
  constructor: (@inType, @outType) ->
    super("Function")
    @on @inType, new Handler(null, @outType, null)

  toDebug: ->
    "(" + @inType.toDebug() + " -> " + @outType.toDebug() + ")"

# class WTraitType extends WType
#   # FIXME wut
#   # handlers is a map of string -> FunctionType
#   constructor: (@handlers) ->
#     super("Trait")

#   toDebug: ->
#     "Trait(" + (for k, v of @handlers then k + ": " + v.toDebug()).join(", ") + ")"


# ----- value types

WUnit = new WObject(WUnitType)
WUnit.toDebug = -> "()"

class WInt extends WObject
  constructor: (@value) ->
    super(WIntType)

  toDebug: -> @value.toString()

  equals: (other) -> (other instanceof WInt) and (other.value == @value)

class WSymbol extends WObject
  constructor: (@name) ->
    super(WSymbolType)

  toDebug: -> ":" + @name

  equals: (other) -> (other instanceof WSymbol) and (other.name == @name)

class WStruct extends WObject
  constructor: (@type, @values) -> 
    super(@type)

  toDebug: -> "(" + (for k, v of @values then k.toDebug() + " = " + v.toDebug()).join(", ") + ")"

  equals: (other) ->
    return false unless (other instanceof WStruct) and other.type.equals(@type)
    for k, v of @values then if not other.values[k].equals(v) then return false
    true

class WFunction extends WObject
  constructor: (@inType, @outType, @body, inScope) ->
    super(new WFunctionType(@inType, @outType))
    @on @inType, new Handler(inScope, @outType, @body)

  toDebug: ->
    "{ #{@type.toDebug()} ... }"


# ----- builtin methods
# FIXME: clean this up.

init = ->
  WIntType.nativeMethod "+", WIntType, WIntType, (runtime, self, n) -> new WInt(self.value + n.value)
  WIntType.nativeMethod "-", WIntType, WIntType, (runtime, self, n) -> new WInt(self.value - n.value)
  WIntType.nativeMethod "*", WIntType, WIntType, (runtime, self, n) -> new WInt(self.value * n.value)
  WIntType.nativeMethod "/", WIntType, WIntType, (runtime, self, n) -> new WInt(Math.floor(self.value / n.value))
  WIntType.nativeMethod "%", WIntType, WIntType, (runtime, self, n) -> new WInt(self.value % n.value)
  WIntType.nativeMethod "negate", WIntType, WIntType, (runtime, self, n) -> new WInt(-self.value)


globalTypes =
  "Unit": WUnitType
  "Int": WIntType
  "Symbol": WSymbolType

exports.WType = WType
exports.WTypeType = WTypeType

exports.WUnitType = WUnitType
exports.WAnyType = WAnyType
exports.WIntType = WIntType
exports.WSymbolType = WSymbolType
exports.WField = WField
exports.WStructType = WStructType
exports.WFunctionType = WFunctionType

exports.WUnit = WUnit
exports.WInt = WInt
exports.WSymbol = WSymbol
exports.WStruct = WStruct
exports.WFunction = WFunction

exports.globalTypes = globalTypes
exports.init = init
