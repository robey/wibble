util = require 'util'
descriptors = require '../transform/descriptors'
d_expr = require '../dump/d_expr'
object = require './object'
r_scope = require './r_scope'
r_type = require './r_type'
t_type = require '../transform/t_type'
types = require './types'

error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

evalExpr = (expr, locals, logger) ->
  logger?("#{d_expr.dumpExpr(expr)}")
  if expr.nothing? then return types.TNothing.create()
  if expr.boolean? then
#    { boolean: true/false }
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
  # { condition: expr, ifThen: expr, ifElse: expr }
  if expr.newObject?
    return evalNew(expr, locals, logger)
  if expr.local?
    rv = evalExpr(expr.value, locals, logger)
    locals.set(expr.local.name, rv)
    return rv
  if expr.on?
    error("Orphan 'on' (shouldn't happen)", expr.state)
  if expr.code?
    newLocals = new r_scope.Scope(locals)
    rv = nothing.WNothing
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
  m = if handler.guard instanceof t_type.TypeDescriptor
    new types.TStruct(handler.guard).coerce(message)
  else
    message
  scope = new r_scope.Scope()
  if m.type instanceof types.TStruct
    for k in m.scope.keys() then scope.set(k, m.scope.get(k))
  return evalExpr(handler.expr, scope, logger)

evalNew = (expr, locals, logger) ->
  type = new r_type.Type(expr.type)
  state = new r_scope.Scope(locals)
  obj = new object.WObject(type, state)

  for x in expr.newObject.code
    if x.on?
      guard = if x.on.symbol?
        types.TSymbol.create(x.on.symbol)
      else
        descriptor = t_type.findType(x.on, descriptors.typemap)
        # this is a little sus.
        for f in descriptor.fields when f.value?
          f.value = evalExpr(f.value, state, logger)
        descriptor
      type.on guard, x.handler
    else
      evalExpr(x, state, logger)
  obj


exports.evalExpr = evalExpr
