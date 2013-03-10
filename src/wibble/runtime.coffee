
util = require("util")
inspect = util.inspect

transform = require("./transform.coffee")
base = require "./runtime_base.coffee"
types = require "./types.coffee"
typecheck = require("./typecheck").typecheck

Scope = base.Scope
Handler = base.Handler
WValue = base.WValue

## ----- values

WUnit = new WValue(types.UnitType)
WUnit.toDebug = -> "()"

class WInt extends WValue
  constructor: (@value) ->
    super(types.IntType)

  toDebug: -> @value.toString()

class WSymbol extends WValue
  constructor: (@name) ->
    super(types.SymbolType)

  toDebug: -> ":" + @name

class WStruct extends WValue
  constructor: (@type, @values) -> 
    super(@type)

  toDebug: -> "(" + (for k, v of @values then k.toDebug() + " = " + v.toDebug()).join(", ") + ")"

class WObject extends WValue
  constructor: (@type, symtab) ->
    super(@type)
    for k, v of symtab then @symtab[k] = v

  toDebug: -> "<object of " + @type.name + ">"

class WFunction extends WValue
  constructor: (@inType, @outType, @body, inScope) ->
    super(new types.FunctionType(@inType, @outType))
    @on @inType, new Handler(inScope, @body)

  toDebug: ->
    @inType.toDebug() + " -> {...}"

class WPrototype extends WValue
  constructor: (@name, @type, @inType, @body, inScope) ->
    super(@type)
    @on @inType, new Handler(inScope, { bless: @body, type: @ })

  toDebug: -> "<prototype #{@name}>"
  
exports.WInt = WInt
exports.WFunction = WFunction


## ----- Runtime

class Runtime
  constructor: ->
    types.init()
    @logger = null
    # default scope (globals) is just the builtin types
    @globals = new Scope()
    for k, v of types.globalTypes then @globals.set(k, v)

  log: (stage, message) ->
    if @logger? then @logger(stage, message)

  # turn a type name into a type object, or panic
  resolveType: (name, scope) ->
    type = scope.get(name)
    if not type? then throw "Unknown type #{name}"
    if type.type != types.TypeType then throw "Not a type: #{name}"
    type

  # turn a params list into a type (StructType or UnitType)
  compileParams: (params, scope) ->
    if params.length == 0 then return types.UnitType
    # create a WFunction
    fields = []
    for p in params
      type = @resolveType(p.type, scope)
      value = if p.value? then @xeval(p.value, scope) else null
      f = new types.WField(p.name, type, value)
      fields.push(f)
    new types.StructType(fields)

  # evaluate the parsed expression, using this scope to resolve symbols.
  xeval: (expr, scope) ->
    if not scope? then scope = @globals
    @log 'eval', transform.dumpExpr(expr) + " in " + scope.toDebug()

    if expr.unit? then return WUnit
    if expr.number?
      switch expr.number
        when "int" then return new WInt(parseInt(expr.value))
    if expr.opref? then return new WSymbol(expr.opref)
    if expr.symbol?
      rv = scope.get(expr.symbol)
      if rv? then return rv
      return new WSymbol(expr.symbol)

    # ---
    if expr.call?
      left = @xeval(expr.call, scope)
      right = @xeval(expr.arg, scope)
      @log 'call', "(#{left.toDebug()}) #{right.toDebug()}"
      rv = @call(left, right)
      @log 'call', "  ==> #{rv.toDebug()}"
      return rv

    if expr.code?
      rv = WUnit
      for x in expr.code
        rv = @xeval(x, scope)
      return rv
    if expr.local?
      rv = @xeval(expr.value, scope)
      scope.set(expr.local, rv)
      return rv
    if expr.func?
      # create a WFunction
      # FIXME: when inside a prototype, should start a new scope.
      inType = @compileParams(expr.params, scope)
      outType = typecheck(expr.func, inType.toSymtab)
      return new WFunction(inType, outType, expr.func, scope)
    if expr.proto?
      # this can only happen at the REPL.
      on_handlers = (item for item in expr.body when item.on?)
      code = (item for item in expr.body when not item.on?)
      inType = @compileParams(expr.params, scope)
      symtab = {}
      handlers = []
      for item in expr.body when item.on?
        if item.on.symbol?
          symtab[item.on.symbol] = new Handler(null, item.handler)
        else
          handlers.push([ @compileParams(item.on.params, scope), new Handler(null, item.handler) ])
      type = new types.ProtoType(inType, symtab, handlers)
      @log 'proto', "Creating prototype #{expr.proto}, signature: #{type.handlersDebug()}"
      rv = new WPrototype(expr.proto, type, inType, code, scope)
      scope.set(expr.proto, rv)
      return rv
    if expr.bless?
      # FIXME hack for prototype: fill scope from expression, then bless it as a type.
      rv = @xeval(expr.bless, scope)
      return new WObject(expr.type, scope)
    throw "unhandled! " + inspect(expr)



  buildProto: (expr, scope) ->


  call: (obj, inMessage) ->
    [ handler, message ] = @handlerForMessage(obj, inMessage)
    if not handler?
      @log 'call', "No handler for message '#{inMessage.toDebug()}' in #{obj.toDebug()}"
      throw "type #{obj.type.toDebug()} can't handle message #{inMessage.toDebug()}"
    # shortcut native-coffeescript implementations:
    if handler.expr instanceof Function then return handler.expr(@, obj, message)
    # unpack struct into locals
    scope = new Scope(handler.scope)
    if message.type instanceof types.StructType
      for k, v of message.values then scope.setNew(k, v)
    else if message == WUnit
      # ok. no extra params.
    else if message.type == types.SymbolType
      # ok. no extra params.
    else
      throw "Internal error: objects always receive struct messages"
    @log 'call', "Nested eval: #{handler.toDebug()}"
    @log 'call', "Nested eval scope: #{scope.toDebug()}"
    @xeval(handler.expr, scope)

  handlerForMessage: (obj, message) ->
    handler = obj.get(message)
    if handler? then return [ handler, message ]
    for [ type, handler ] in obj.getHandlers()
      # match type
      mm = @coerce(type, message)
      if mm? then return [ handler, mm ]
    [ null, null ]

  # can 'value' be coerced to be the same type as 'type'? if so, return a new
  # value with that coercion. otherwise return null.
  coerce: (type, value) ->
    if type == value.type then return value
    if type instanceof types.StructType
      # oh man.
      fields = type.fields
      if fields.length == 0 and value.type == types.UnitType
        return new WStruct(type, {})
      if fields.length == 1 and value.type == fields[0].type
        # odd bug in coffeescript syntax parser
        x = {}
        x[fields[0].name] = value
        return new WStruct(type, x)
    null

exports.Scope = Scope
exports.Runtime = Runtime


# FIXME bug:

#★> val  x = 3
#parse ⚑ val :x = 3
#parse ⚑ val :x = 3
#eval  val :x = 3
#eval  3
#☄ [Int] 3
#★> x
#parse ⚑ :x
#parse ⚑ :x
#eval  :x
#☄ [Int] 3
#★> square 9
#parse ⚑ (:square 9)
#parse ⚑ (:square 9)
#eval  (:square 9)
#eval  :square
#eval  9
#call  ((x: Int) -> {...}) 9
#call  Nested eval: { scope: 
#   { parent: undefined,
#     symtab: 
#      { Unit: [Object],
#        Int: [Object],
#        Symbol: [Object],
#        square: [Object],
#        x: undefined } },
#  expr: 
#   { call: { call: [Object], arg: [Object] },
#     arg: { symbol: 'x' } } }
#call  Nested eval scope: { parent: 
#   { parent: undefined,
#     symtab: 
#      { Unit: [Object],
#        Int: [Object],
#        Symbol: [Object],
#        square: [Object],
#        x: undefined } },
#  symtab: {} }
#eval  ((:x :*) :x)
#eval  (:x :*)
#eval  :x
#eval  :*
#call  (:x) :*
#call  No handler for message ':*' in :x
#☹☹☹ type Symbol can't handle message :*####
#
#/Users/robey/projects/node/wibble/Cakefile:172
#          throw e;
#                ^
#type Symbol can't handle message :*#

