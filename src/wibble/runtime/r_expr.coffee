util = require 'util'
dump = require '../dump'
transform = require '../transform'
object = require './object'
r_namespace = require './r_namespace'
r_type = require './r_type'
types = require './types'

error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

evalExpr = (expr, locals, logger) ->
  logger?("#{dump.dumpExpr(expr)} -in- #{locals.toDebug()}")
  if expr.nothing? then return types.TNothing.create()
  if expr.boolean? then return types.TBoolean.create(expr.boolean)
  if expr.number?
    switch expr.number
      when "base2" then return types.TInt.create(expr.value, 2)
      when "base10" then return types.TInt.create(expr.value, 10)
      when "base16" then return types.TInt.create(expr.value, 16)
#    { number: long-base2/long-base10/long-base16/float/long-float, value: "" }
  if expr.symbol? then return types.TSymbol.create(expr.symbol)
#    { string: "" }
  if expr.reference?
    rv = locals.get(expr.reference)
    if not rv? then error("Missing reference '#{expr.reference}'", expr.state)
    return rv
  # array
  if expr.struct?
    values = {}
    for f in expr.struct then values[f.name] = evalExpr(f.value, locals, logger)
    return new types.TStruct(expr.type).create(values)
  if expr.call?
    left = evalExpr(expr.call, locals, logger)
    right = evalExpr(expr.arg, locals, logger)
    logger?("call: ([#{left.type.toRepr()}] #{left.toRepr()}) #{right.toRepr()}")
    rv = evalCall(left, right, expr.state, logger)
    logger?("  \u21b3 [#{rv.type.toRepr()}] #{rv.toRepr()}")
    return rv
  if expr.condition?
    cond = evalExpr(expr.condition, locals, logger)
    if cond.equals(types.TBoolean.create(true))
      return evalExpr(expr.ifThen, locals, logger)
    else
      return evalExpr(expr.ifElse, locals, logger)
  if expr.newObject?
    return evalNew(expr, locals, logger)
  if expr.local?
    rv = evalExpr(expr.value, locals, logger)
    locals.set(expr.local.name, rv)
    return rv
  if expr.on?
    error("Orphan 'on' (shouldn't happen)", expr.state)
  if expr.code?
    newLocals = new r_namespace.Namespace(locals)
    rv = types.TNothing.create()
    for x in expr.code
      rv = evalExpr(x, newLocals, logger)
    return rv

  error("Not yet implemented", expr.state)

evalCall = (target, message, state, logger) ->
  handler = target.type.handlerForMessage(message)
  if not handler?
    logger?("No handler for message <#{message.toRepr()}> in #{target.toRepr()}")
    error("Object [#{target.type.toRepr()}] #{target.toRepr()} can't handle message #{message.toRepr()}", state)
  # shortcut native-coffeescript implementations:
  if typeof handler.expr == "function"
    return handler.expr(target, message)
  m = if handler.guard instanceof transform.TypeDescriptor
    new types.TStruct(handler.guard).coerce(message)
  else
    message
  locals = new r_namespace.Namespace(handler.locals)
  if m.type instanceof types.TStruct
    for k in m.state.keys() then locals.set(k, m.state.get(k))
  return evalExpr(handler.expr, locals, logger)

evalNew = (expr, locals, logger) ->
  type = new r_type.Type(expr.type, expr.newObject)
  state = new r_namespace.Namespace(locals)
  obj = new object.WObject(type, state)

  for x in expr.newObject.code
    if x.on?
      guard = if x.on.symbol?
        types.TSymbol.create(x.on.symbol)
      else
        descriptor = transform.findType(x.on, transform.typemap)
        # this is a little sus.
        for f in descriptor.fields when f.value?
          f.value = evalExpr(f.value, state, logger)
        descriptor
      type.on guard, x.handler
    else
      evalExpr(x, state, logger)
  obj


exports.evalExpr = evalExpr
