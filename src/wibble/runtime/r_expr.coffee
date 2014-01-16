util = require 'util'
d_expr = require '../dump/d_expr'
int = require './int'
nothing = require './nothing'
symbol = require './symbol'

# FIXME move this
error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

evalExpr = (expr, locals, logger) ->
  logger?("#{d_expr.dumpExpr(expr)}")
  if expr.nothing? then return nothing.WNothing
  if expr.number?
    switch expr.number
      when "base2" then return new int.WInt(expr.value, 2)
      when "base10" then return new int.WInt(expr.value, 10)
      when "base16" then return new int.WInt(expr.value, 16)
#    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
  if expr.symbol? then return new symbol.WSymbol(expr.symbol)
  # string
  if expr.reference?
    rv = locals.get(expr.reference)
    if not rv? then error("Missing reference '#{expr.reference}'", expr.state)
    return rv
  # array
  # struct
  if expr.call?
    left = evalExpr(expr.call, locals, logger)
    right = evalExpr(expr.arg, locals, logger)
    logger?("call: (#{left.toRepr()}) #{right.toRepr()}")
    rv = evalCall(left, right, expr.state, logger)
    logger?("  \u21b3 #{rv.toRepr()}")
    return rv

  if expr.local?
    rv = evalExpr(expr.value, locals, logger)
    locals.set(expr.local.name, rv)
    return rv
  if expr.code?
    rv = nothing.WNothing
    for x in expr.code
      rv = evalExpr(x, locals, logger)
    return rv

  error("Not yet implemented", expr.state)

evalCall = (target, message, state, logger) ->
  handler = target.handlerForMessage(message)
  if not handler?
    logger?("No handler for message <#{message.toRepr()}> in #{target.toRepr()}")
    error("Object [#{target.type.toRepr()}] #{target.toRepr()} can't handle message #{message.toRepr()}", state)
  # shortcut native-coffeescript implementations:
  if typeof handler.expr == "function"
    return handler.expr(target, message)


exports.evalExpr = evalExpr


# call: (obj, inMessage) ->
#   # unpack struct into locals
#   scope = new Scope(handler.scope)
#   if message.type instanceof types.WStructType
#     for k, v of message.values then scope.setNew(k, v)
#   else if message == WUnit
#     # ok. no extra params.
#   else if message.type == types.WSymbolType
#     # ok. no extra params.
#   else
#     throw new Error("Internal error: objects always receive struct messages")
#   @log 'call', "Nested eval: #{handler.toDebug()}"
#   @log 'call', "Nested eval scope: #{scope.toDebug()}"
#   @xeval(handler.expr, scope)
