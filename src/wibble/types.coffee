base = require "./runtime_base.coffee"

class Type extends base.WValue
  constructor: (@name) ->
    super(TypeType)

  toDebug: -> @name

  toSymtab: -> new base.Scope()

TypeType = new Type("Type")
UnitType = new Type("Unit")
IntType = new Type("Int")
SymbolType = new Type("Symbol")

class WField
  constructor: (@name, @type, @value) ->

  toDebug: ->
    @name + ": " + @type.toDebug() + (if @value? then (" = " + @value.toDebug()) else "")

class StructType extends Type
  constructor: (@fields) ->
    super("Struct")

  toDebug: ->
    "(" + @fields.map((f) -> f.toDebug()).join(", ") + ")"

  toSymtab: ->
    symtab = new base.Scope()
    for f in @fields
      symtab.setNew(f.name, f.type)
    symtab

class FunctionType extends Type
  constructor: (@inType, @outType) ->
    super("Function")

  toDebug: ->
    "Function(" + @inType.toDebug() + " -> " + @outType.toDebug() + ")"

class TraitType extends Type
  # handlers is a map of string -> FunctionType
  constructor: (@handlers) ->
    super("Trait")

  toDebug: ->
    "Trait(" + (for k, v of @handlers then k + ": " + v.toDebug()).join(", ") + ")"

class ProtoType extends Type
  constructor: (@inType, symtab, handlers) ->
    super("Prototype")
    @symtab = symtab
    @handlers = handlers

## ----- builtin methods
## FIXME: clean this up.

init = ->
  runtime = require "./runtime.coffee"
  WInt = runtime.WInt
  WFunction = runtime.WFunction
  
  IntType.on "+", (runtime, self, message) ->
    new WFunction(IntType, IntType, (runtime, func, n) -> new WInt(self.value + n.value))

  IntType.on "-", (runtime, self, message) ->
    new WFunction(IntType, IntType, (runtime, func, n) -> new WInt(self.value - n.value))

  IntType.on "*", (runtime, self, message) ->
    new WFunction(IntType, IntType, (runtime, func, n) -> new WInt(self.value * n.value))

  IntType.on "/", (runtime, self, message) ->
    new WFunction(IntType, IntType, (runtime, func, n) -> new WInt(self.value / n.value))

  IntType.on "%", (runtime, self, message) ->
    new WFunction(IntType, IntType, (runtime, func, n) -> new WInt(self.value % n.value))

  IntType.on "negate", (runtime, self, message) ->
    new WFunction(UnitType, IntType, (runtime, func, n) -> new WInt(-self.value))

globalTypes =
  "Unit": UnitType
  "Int": IntType
  "Symbol": SymbolType

exports.TypeType = TypeType
exports.UnitType = UnitType
exports.IntType = IntType
exports.SymbolType = SymbolType
exports.WField = WField
exports.StructType = StructType
exports.FunctionType = FunctionType
exports.TraitType = TraitType
exports.ProtoType = ProtoType
exports.globalTypes = globalTypes
exports.init = init
