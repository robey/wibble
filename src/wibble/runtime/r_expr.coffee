util = require 'util'
d_expr = require '../dump/d_expr'
int = require './int'

evalExpr = (expr, scope, logger) ->
  logger?("#{d_expr.dumpExpr(expr)}")
#    if expr.unit? then return WUnit
  if expr.number?
    switch expr.number
      when "base2" then return new int.WInt(expr.value, 2)
      when "base10" then return new int.WInt(expr.value, 10)
      when "base16" then return new int.WInt(expr.value, 16)
#    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
  throw new Error("Not yet.")

    # if expr.opref? then return new WSymbol(expr.opref)
    # if expr.symbol?
    #   rv = scope.get(expr.symbol)
    #   if rv? then return rv
    #   return new WSymbol(expr.symbol)


exports.evalExpr = evalExpr
