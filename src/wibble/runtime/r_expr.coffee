util = require 'util'
d_expr = require '../dump/d_expr'
int = require './int'
nothing = require './nothing'
symbol = require './symbol'

evalExpr = (expr, scope, logger) ->
  logger?("#{d_expr.dumpExpr(expr)}")
  if expr.nothing? then return nothing.WNothing
  if expr.number?
    switch expr.number
      when "base2" then return new int.WInt(expr.value, 2)
      when "base10" then return new int.WInt(expr.value, 10)
      when "base16" then return new int.WInt(expr.value, 16)
#    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
  if expr.symbol? then return new symbol.WSymbol(expr.symbol)

  if expr.call?
    left = evalExpr(expr.call, scope, logger)
    right = evalExpr(expr.arg, scope, logger)
    logger?("call: (#{left.toRepr()}) #{right.toRepr()}")
    rv = evalCall(left, right, logger)
    logger?("  \u21b3 #{rv.toRepr()}")
    return rv

  throw new Error("Not yet.")

evalCall = (target, message, logger) ->
  handler = target.handlerForMessage(message)
  if not handler?
    logger?("No handler for message <#{message.toRepr()}> in #{target.toRepr()}")
    throw new Error("Object [#{target.type.toRepr()}] #{target.toRepr()} can't handle message #{message.toRepr()}")
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
