
util = require("util")
inspect = util.inspect

transform = require("./transform.coffee")
base = require "./runtime_base.coffee"
object = require "./object.coffee"
types = require "./types.coffee"
typecheck = require("./typecheck")

Scope = base.Scope
Handler = base.Handler
TypeChecker = typecheck.TypeChecker
WObject = object.WObject
WUnit = types.WUnit
WInt = types.WInt
WSymbol = types.WSymbol
WFunction = types.WFunction

## ----- Runtime

class Runtime
  constructor: ->
    types.init()
    @logger = null
    # default scope (globals) is just the builtin types
    @globals = new Scope()
    for k, v of types.globalTypes then @globals.set(k, v)
    @typeChecker = new TypeChecker(((message) => @log('type', message)), @globals)

  log: (stage, message) ->
    if @logger? then @logger(stage, message)

  # turn a type name into a type object, or panic
  resolveType: (name, scope) ->
    type = scope.get(name)
    if not type? then throw new Error("Unknown type #{name}")
    if type.type != types.WTypeType then throw new Error("Not a type: #{name}")
    type

  # turn a params list into a type (StructType or UnitType)
  compileParams: (params, scope) ->
    if params.length == 0 then return types.WUnitType
    # create a WFunction
    fields = []
    for p in params
      type = @resolveType(p.type, scope)
      value = if p.value? then @xeval(p.value, scope) else null
      f = new types.WField(p.name, type, value)
      fields.push(f)
    new types.WStructType(fields)

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
      @log 'call', "  \u21b3 #{rv.toDebug()}"
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
      # FIXME: why is this here? why is there no type scope?
      ftype = @typeChecker.check(expr)
      return new WFunction(ftype, expr.func)
    if expr.proto?
      # this can only happen at the REPL.
      on_handlers = (item for item in expr.body when item.on?)
      code = (item for item in expr.body when not item.on?)
      inType = @compileParams(expr.params, scope)
      symtab = {}
      handlers = []
      for item in on_handlers
        if item.on.symbol?
          # fixme fixme fixme
          symtab[item.on.symbol] = new Handler(null, item.handler)
        else
          # fixme fixme fixme
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
    throw new Error("unhandled! " + inspect(expr))



  buildProto: (expr, scope) ->


  call: (obj, inMessage) ->
    [ type, handler ] = obj.handlerForMessage(inMessage)
    if not handler?
      [ type, handler ] = obj.type.handlerForMessage(inMessage)
    if not handler?
      @log 'call', "No handler for message '#{inMessage.toDebug()}' in #{obj.toDebug()}"
      throw new Error("type #{obj.type.toDebug()} can't handle message #{inMessage.toDebug()}")
    message = type.coerceValue(inMessage)
    # shortcut native-coffeescript implementations:
    if typeof handler.expr == "function" then return handler.expr(@, obj, message)
    # unpack struct into locals
    scope = new Scope(handler.scope)
    if message.type instanceof types.WStructType
      for k, v of message.values then scope.setNew(k, v)
    else if message == WUnit
      # ok. no extra params.
    else if message.type == types.WSymbolType
      # ok. no extra params.
    else
      throw new Error("Internal error: objects always receive struct messages")
    @log 'call', "Nested eval: #{handler.toDebug()}"
    @log 'call', "Nested eval scope: #{scope.toDebug()}"
    @xeval(handler.expr, scope)


exports.Runtime = Runtime


# FIXME bug: { w(), }

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

