
util = require("util")
inspect = util.inspect

transform = require("./transform.coffee")

# a context is a map of (symbol -> value), possibly chained to a parent context.
class Context
  constructor: (@parent) ->
    @symtab = {}
    @handlers = []
  
  toDebug: -> if @parent then @parent.toDebug() else "<bare context>"

  get: (name) ->
    if @symtab[name]? then return @symtab[name]
    if @parent? then return @parent.get(name)
    null

  update: (name, value) ->
    if @symtab[name]?
      @symtab[name] = value
      return true
    @parent? and @parent.update(name)

  set: (name, value) ->
    if not @update(name, value) then @symtab[name] = value

  on: (message, action) ->
    if typeof message == "string"
      @symtab[message] = action
    else
      @handlers.push([ message, action ])

## -----

class Type extends Context
  constructor: (@name) ->
    super()
    @type = TypeType
    @handlers = {}

  toDebug: -> @name

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

class FunctionType extends Type
  constructor: (@inType, @outType) ->
    super("Function")

  toDebug: ->
    "Function(" + @inType.toDebug() + " -> " + @outType.toDebug() + ")"

## -----


class WValue
  constructor: (@type) ->
    @context = new Context(@type)

WUnit = new WValue(UnitType)
WUnit.toDebug = -> "()"

class WInt extends WValue
  constructor: (@value) ->
    super(IntType)

  toDebug: -> @value.toString()

class WSymbol extends WValue
  constructor: (@name) ->
    super(SymbolType)

  toDebug: -> ":" + @name

class WStruct extends WValue
  constructor: (@type, @values) -> 
    super(@type)

  toDebug: -> "(" + (for k, v of @values then k.toDebug() + " = " + v.toDebug()).join(", ") + ")"

class WFunction extends Context
  constructor: (parent, @inType, @body) ->
    super(parent)
    # FIXME: UnitType is wrong. fix that later by deducing type.
    @type = new FunctionType(@inType, UnitType)
    @context = @
    @on @inType, (runtime, self, message) =>
      if @body instanceof Function then return @body(runtime, self, message)
      # unpack struct into locals
      c = new Context(this)
      if message.type instanceof StructType
        for k, v of message.values then c.set(k, v)
      else if message == WUnit
        # ok. no extra params.
      else
        throw "Internal error: functions always receive struct messages"
      runtime.xeval(@body, c)

  toDebug: ->
    @inType.toDebug() + " -> {...}"


IntType.on "+", (runtime, self, message) ->
  new WFunction(null, IntType, (runtime, func, n) -> new WInt(self.value + n.value))

IntType.on "-", (runtime, self, message) ->
  new WFunction(null, IntType, (runtime, func, n) -> new WInt(self.value - n.value))

IntType.on "*", (runtime, self, message) ->
  new WFunction(null, IntType, (runtime, func, n) -> new WInt(self.value * n.value))

IntType.on "/", (runtime, self, message) ->
  new WFunction(null, IntType, (runtime, func, n) -> new WInt(self.value / n.value))

IntType.on "%", (runtime, self, message) ->
  new WFunction(null, IntType, (runtime, func, n) -> new WInt(self.value % n.value))

globalTypes =
  "Int": IntType
  "Unit": UnitType
  "Symbol": SymbolType


## ----- Runtime

class Runtime
  constructor: ->
    @logger = null
    # default context (globals) is just the builtin types
    @context = new Context()
    for k, v of globalTypes then @context.set(k, v)

  log: (stage, message) ->
    if @logger? then @logger(stage, message)

  # turn a type name into a type object, or panic
  resolveType: (name, context) ->
    type = context.get(name)
    if not type? then throw "Unknown type #{name}"
    if type.type != TypeType then throw "Not a type: #{name}"
    type

  # evaluate the parsed expression, using this context to resolve symbols.
  xeval: (expr, context) ->
    if not context? then context = @context

    if expr.unit? then return WUnit
    if expr.number?
      switch expr.number
        when "int" then return new WInt(parseInt(expr.value))
    if expr.opref? then return new WSymbol(expr.opref)
    if expr.symbol?
      rv = context.get(expr.symbol)
      if rv? then return rv
      return new WSymbol(expr.symbol)

    # ---
    if expr.call?
      left = @xeval(expr.call, context)
      right = @xeval(expr.arg, context)
      @log 'call', "(#{left.toDebug()}) #{right.toDebug()}"
      rv = @call(left, right)
      @log 'call', "  ==> #{rv.toDebug()}"
      return rv

    if expr.code?
      rv = WUnit
      for x in expr.code
        rv = @xeval(x, context)
      return rv

    if expr.params?
      # create a WFunction
      fields = []
      for p in expr.params
        type = @resolveType(p.type, context)
        value = if p.value? then @xeval(p.value, context) else null
        f = new WField(p.name, type, value)
        fields.push(f)
      inType = if fields.length == 0 then UnitType else new StructType(fields)
      return new WFunction(context, inType, expr.body)

  call: (obj, message) ->
    if message.type == SymbolType
      handler = obj.context.get(message.name)
      if handler? then return handler(this, obj, message)
    for [ k, handler ] in obj.context.handlers
      if k.type == TypeType
        # match type
        type = k
        mm = @coerce(type, message)
        if mm? then return handler(this, obj, mm)
#      else if k.
        # value ==
    @log 'call', "No handler for message '#{message.toDebug()}' in #{obj.toDebug()}"
    throw "type #{obj.type.toDebug()} can't handle message #{message.toDebug()}"

  # can 'value' be coerced to be the same type as 'type'? if so, return a new
  # value with that coercion. otherwise return null.
  coerce: (type, value) ->
    if type == value.type then return value
    if type instanceof StructType
      # oh man.
      fields = type.fields
      if fields.length == 0 and value.type == UnitType
        return new WStruct(type, {})
      if fields.length == 1 and value.type == fields[0].type
        # odd bug in coffeescript syntax parser
        x = {}
        x[fields[0].name] = value
        return new WStruct(type, x)
    null

exports.Context = Context
exports.Runtime = Runtime
