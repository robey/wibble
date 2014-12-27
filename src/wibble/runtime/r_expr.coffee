util = require 'util'
dump = require '../dump'
transform = require '../transform'
object = require './object'
r_namespace = require './r_namespace'
r_type = require './r_type'
types = require './types'

class RuntimeState
  constructor: (options = {}) ->
    if options.logger? then @logger = options.logger
    if options.deadline? then @deadline = options.deadline
    @locals = if options.locals? then options.locals else new r_namespace.Namespace()
    @typemap = if options.typemap? then options.typemap else transform.typemap

  push: ->
    new RuntimeState(
      logger: @logger
      deadline: @deadline
      locals: @locals.push()
      typemap: @typemap.push()
    )

  pushLocals: (locals) ->
    new RuntimeState(
      logger: @logger
      deadline: @deadline
      locals: locals.push()
      typemap: @typemap
    )


error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

evalExpr = (expr, rstate) ->
  if rstate.deadline? and Date.now() > rstate.deadline then error("Out of time", expr.state)
  recurse = (e) -> evalExpr(e, rstate)

  rstate.logger?("#{dump.dumpExpr(expr)} -in- #{rstate.locals.toDebug()}")
  if expr.nothing? then return types.TNothing.create()
  if expr.boolean? then return types.TBoolean.create(expr.boolean)
  if expr.number?
    switch expr.number
      when "base2" then return types.TInt.create(expr.value, 2)
      when "base10" then return types.TInt.create(expr.value, 10)
      when "base16" then return types.TInt.create(expr.value, 16)
#    { number: long-base2/long-base10/long-base16/float/long-float, value: "" }
  if expr.symbol? then return types.TSymbol.create(expr.symbol)
  if expr.string? then return types.TString.create(expr.string)
  if expr.reference?
    rv = rstate.locals.get(expr.reference)
    if not rv? then error("Missing reference '#{expr.reference}'", expr.state)
    return rv
  # array
  if expr.struct?
    values = {}
    for f in expr.struct then values[f.name] = recurse(f.value)
    return new types.TStruct(expr.type).create(values)
  if expr.logic?
    left = recurse(expr.left)
    if not (left.type == types.TBoolean) then error("Boolean required", expr.left.state)
    if expr.logic == "and" and not left.native.value then return left
    if expr.logic == "or" and left.native.value then return left
    return recurse(expr.right)
  if expr.call?
    left = recurse(expr.call)
    right = recurse(expr.arg)
    rstate.logger?("call: ([#{left.type.inspect()}] #{left.inspect()}) #{right.inspect()}")
    rv = evalCall(left, right, expr.state, rstate)
    rstate.logger?("  \u21b3 [#{rv.type.inspect()}] #{rv.inspect()}")
    return rv
  if expr.condition?
    cond = recurse(expr.condition)
    if cond.equals(types.TBoolean.create(true))
      return recurse(expr.ifThen)
    else
      return recurse(expr.ifElse)
  if expr.newObject?
    return evalNew(expr, rstate)
  if expr.local?
    rv = recurse(expr.value)
    rstate.locals.set(expr.local.name, rv)
    return rv
  if expr.on?
    error("Orphan 'on' (shouldn't happen)", expr.state)
  if expr.code?
    rstate = rstate.push()
    rv = types.TNothing.create()
    for x in expr.code
      rv = evalExpr(x, rstate)
    return rv

  error("Not yet implemented", expr.state)

evalCall = (target, message, state, rstate) ->
  handler = target.type.handlerForMessage(message)
  if not handler?
    rstate.logger?("No handler for message <#{message.inspect()}> in #{target.inspect()}")
    error("Object [#{target.type.inspect()}] #{target.inspect()} can't handle message #{message.inspect()}", state)
  # shortcut native-coffeescript implementations:
  if typeof handler.expr == "function"
    return handler.expr(target, message)
  m = if handler.guard instanceof transform.TypeDescriptor
    new types.TStruct(handler.guard).coerce(message)
  else
    message
  evalRawCall(rstate, handler, m)

evalRawCall = (rstate, handler, message) ->
  rstate = rstate.pushLocals(handler.locals)
  if message.type instanceof types.TStruct
    for k in message.state.keys() then rstate.locals.set(k, message.state.get(k))
  return evalExpr(handler.expr, rstate)

evalNew = (expr, rstate) ->
  type = new r_type.Type(expr.type, expr)
  rstate = rstate.push()
  if not expr.stateless then rstate.typemap.add "@", expr.type
  obj = new object.WObject(type, rstate.locals)

  for x in expr.newObject.code
    if x.on?
      guard = if x.on.symbol?
        types.TSymbol.create(x.on.symbol)
      else
        descriptor = transform.findType(x.on, rstate.typemap)
        # this is a little sus.
        for f in descriptor.fields when f.value?
          f.value = evalExpr(f.value, rstate)
        descriptor
      rstate.logger?("on #{guard} locals: #{rstate.locals.toDebug()}")
      type.on guard, rstate.locals, x.handler
    else
      evalExpr(x, rstate)
  obj

# hacky (for now) way to let wibble objects override ":inspect"
# if an object has a handler for (:inspect -> String), call that first, then call native .inspect()
inspect = (target, rstate) ->
  handlerType = target.type.descriptor.handlerTypeForMessage(transform.DSymbol, ":inspect")
  if handlerType? and handlerType.equals(transform.DString)
    inspectSymbol = types.TSymbol.create(":inspect")
    handler = target.type.handlerForMessage(inspectSymbol)
    target = evalRawCall(rstate, handler, inspectSymbol)
  target.inspect()


exports.evalExpr = evalExpr
exports.inspect = inspect
exports.RuntimeState = RuntimeState
