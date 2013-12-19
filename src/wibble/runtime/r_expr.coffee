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
  throw new Error("Not yet.")


exports.evalExpr = evalExpr
