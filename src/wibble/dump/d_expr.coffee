util = require 'util'
misc = require '../misc'
p_common = require '../parser/p_common'

OPERATORS = p_common.OPERATORS
PRECEDENCE = p_common.PRECEDENCE
RESERVED = p_common.RESERVED

#
# dump expressions
#

dumpExpr = (expr) ->
  [ rv, precedence ] = dump(expr)
  rv

dump = (expr) ->
  # constants
  if expr.nothing? then return [ "()", PRECEDENCE.constant ]
  if expr.boolean? then return [ expr.boolean.toString(), PRECEDENCE.constant ]
  if expr.number?
    rv = switch expr.number
      when "base2" then "0b#{expr.value}"
      when "base10" then expr.value
      when "base16" then "0x#{expr.value}"
      when "long-base2" then "0b#{expr.value}L"
      when "long-base10" then "#{expr.value}L"
      when "long-base16" then "0x#{expr.value}L"
      when "float" then expr.value
      when "long-float" then "#{expr.value}L"
    return [ rv, PRECEDENCE.constant ]
  if expr.symbol?
    if RESERVED.indexOf(expr.symbol) >= 0 or OPERATORS.indexOf(expr.symbol) >= 0
      return [ ":#{expr.symbol}", PRECEDENCE.constant ]
    else
      return [ expr.symbol, PRECEDENCE.constant ]
  if expr.string?
    return [ "\"" + misc.cstring(expr.string) + "\"", PRECEDENCE.constant ]

  # array/map/struct: PRECEDENCE.atom

  if expr.unary?
    return [ expr.unary + parenthesize(expr.right, PRECEDENCE.unary), PRECEDENCE.unary ]
  if expr.call?
    return [ parenthesize(expr.call, PRECEDENCE.call + 1) + " " + parenthesize(expr.arg, PRECEDENCE.call), PRECEDENCE.call ]
  if expr.binary?
    return [ parenthesize(expr.left, PRECEDENCE[expr.binary] + 1) + " #{expr.binary} " + parenthesize(expr.right, PRECEDENCE[expr.binary]), PRECEDENCE.binary ]
  if expr.condition?
    condition = parenthesize(expr.condition, PRECEDENCE.ifThen)
    ifThen = parenthesize(expr.ifThen, PRECEDENCE.ifThen)
    ifElse = if expr.ifElse then parenthesize(expr.ifElse, PRECEDENCE.ifThen) else null
    return [ "if #{condition} then #{ifThen}" + (if ifElse then " else #{ifElse}" else ""), PRECEDENCE.ifThen ]
  "???"

parenthesize = (expr, myPrecedence) ->
  [ rv, p ] = dump(expr)
  if p >= myPrecedence then "(#{rv})" else rv

  # expressions
    # { array: [ expr* ] }
    # { map: [ [ expr, expr ]* ] }
    # { struct: [ { name?, expression: expr }* ] }

exports.dumpExpr = dumpExpr

# # build a simple string representation of a parsed expression
# dumpExpr = (expr) ->
#   if expr.struct?
#     fields = for field in expr.struct
#       if field.name?
#         field.name + " = " + dumpExpr(field.expression)
#       else
#         dumpExpr(field.expression)
#     return "(" + fields.join(", ") + ")"
#   if expr.code?
#     return "{ " + (dumpExpr(e) for e in expr.code).join("; ") + " }"
#   if expr.local?
#     return "val :" + expr.local + " = " + dumpExpr(expr.value)
#   if expr.func?
#     params = for p in expr.params
#       p.name + ": " + p.type + (if p.value? then (" = " + dumpExpr(p.value)) else "")
#     return "((" + params.join(", ") + ") -> " + dumpExpr(expr.func) + ")"
#   if expr.on?
#     return "on " + dumpExpr(expr.on) + " -> " + dumpExpr(expr.handler)
#   if expr.method?
#     params = for p in expr.params
#       p.name + ": " + p.type + (if p.value? then (" = " + dumpExpr(p.value)) else "")
#     return "def :" + expr.method + "(" + params.join(", ") + ") -> " + dumpExpr(expr.body) + ")"
#   if expr.proto?
#     params = for p in expr.params
#       p.name + ": " + p.type + (if p.value? then (" = " + dumpExpr(p.value)) else "")
#     codes = for x in expr.body then dumpExpr(x)
#     return "prototype " + expr.proto + "(" + params.join(", ") + ") { " + codes.join("; ") + " }"
#   "???" + inspect(expr)
