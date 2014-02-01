util = require 'util'
builtins = require '../transform/builtins'
d_expr = require '../dump/d_expr'
#func = require './func'
int = require './int'
#nothing = require './nothing'
object = require './object'
r_scope = require './r_scope'
r_type = require './r_type'
symbol = require './symbol'
t_type = require '../transform/t_type'

error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

evalExpr = (expr, locals, logger) ->
  logger?("#{d_expr.dumpExpr(expr)}")
  if expr.nothing? then return nothing.WNothing
  if expr.boolean? then
#    { boolean: true/false }
  if expr.number?
    switch expr.number
      when "base2" then return int.TInt.create(expr.value, 2)
      when "base10" then return int.TInt.create(expr.value, 10)
      when "base16" then return int.TInt.create(expr.value, 16)
#    { number: long-base2/long-base10/long-base16/float/long-float, value: "" }
  if expr.symbol? then return symbol.TSymbol.create(expr.symbol)
#    { string: "" }
  if expr.reference?
    rv = locals.get(expr.reference)
    if not rv? then error("Missing reference '#{expr.reference}'", expr.state)
    return rv
  # array
  # struct
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
    locals.setNew(expr.local.name, rv)
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
  m = if handler.guard instanceof t_type.TypeDescriptor then handler.guard.coerce(message) else message
  scope = new r_scope.Scope()
  if m.type.descriptor instanceof t_type.CompoundType
    for k, v of m.values then scope.setNew(k, v)
  return evalExpr(handler.expr, scope, logger)

evalNew = (expr, locals, logger) ->
  type = new r_type.Type(expr.type)
  state = new r_scope.Scope(locals)
  obj = new object.WObject(type, state)

  for x in expr.newObject.code
    if x.on?
      guard = if x.on.symbol? then symbol.TSymbol.create(x.on.symbol) else t_type.findType(x.on, builtins.typemap)
      type.on guard, x.handler
    else
      evalExpr(x, state, logger)
  obj


exports.evalExpr = evalExpr
