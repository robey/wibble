util = require 'util'
misc = require '../misc'
p_common = require '../parser/p_common'
d_type = require './d_type'

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
    return [ ".#{expr.symbol}", PRECEDENCE.constant ]
  if expr.string?
    return [ "\"" + misc.cstring(expr.string) + "\"", PRECEDENCE.constant ]
  if expr.reference?
    return [ expr.reference, PRECEDENCE.constant ]
  if expr.array?
    if expr.array.length == 0 then return [ "[]", PRECEDENCE.atom ]
    return [ "[ " + expr.array.map(dumpExpr).join(", ") + " ]", PRECEDENCE.atom ]
  if expr.struct?
    items = expr.struct.map (item) ->
      (if item.name? then "#{item.name} = " else "") + dumpExpr(item.expression)
    return [ "(" + items.join(", ") + ")", PRECEDENCE.atom ]
  if expr.unary?
    return [ expr.unary + parenthesize(expr.right, PRECEDENCE.unary), PRECEDENCE.unary ]
  if expr.call?
    # prettify symbol-calls, and paren-wrapped args.
    arg = parenthesize(expr.arg, PRECEDENCE.call)
    space = if expr.arg.symbol? or arg[0] == "(" then "" else " "
    return [ parenthesize(expr.call, PRECEDENCE.call + 1) + space + arg, PRECEDENCE.call ]
  if expr.binary?
    return [ parenthesize(expr.left, PRECEDENCE[expr.binary] + 1) + " #{expr.binary} " + parenthesize(expr.right, PRECEDENCE[expr.binary]), PRECEDENCE[expr.binary] ]
  if expr.condition?
    condition = parenthesize(expr.condition, PRECEDENCE.ifThen)
    ifThen = parenthesize(expr.ifThen, PRECEDENCE.ifThen)
    ifElse = if expr.ifElse then parenthesize(expr.ifElse, PRECEDENCE.ifThen) else null
    return [ "if #{condition} then #{ifThen}" + (if ifElse then " else #{ifElse}" else ""), PRECEDENCE.ifThen ]
  if expr.functionx?
    parameters = expr.parameters.map (p) -> p.name + (if p.type? then ": " + d_type.dumpType(p.type) else "") + (if p.value? then " = " + dumpExpr(p.value) else "")
    return [ (if parameters.length > 0 then "(" + parameters.join(", ") + ") " else "") + "-> " + dumpExpr(expr.functionx), PRECEDENCE.code ]
  if expr.local?
    return [ "val #{expr.local.name} = #{dumpExpr(expr.value)}", PRECEDENCE.code ]
  if expr.code?
    return [ "{ " + expr.code.map(dumpExpr).join('; ') + " }", PRECEDENCE.constant ]
  [ "???(#{util.inspect(expr)})", PRECEDENCE.none ]

parenthesize = (expr, myPrecedence) ->
  [ rv, p ] = dump(expr)
  if p >= myPrecedence then "(#{rv})" else rv


exports.dumpExpr = dumpExpr
