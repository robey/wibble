util = require 'util'
misc = require '../misc'
d_expr = require './d_expr'
p_common = require '../parser/p_common'

OPERATORS = p_common.OPERATORS
PRECEDENCE = p_common.PRECEDENCE
RESERVED = p_common.RESERVED

#
# dump types
#

dumpType = (t) ->
  if t.typename? then return t.typename
  if t.namedType? then return "#{t.name}: #{dumpType(t.namedType)}"
  if t.compoundType?
    return "(" + t.compoundType.map(dumpNamedType).join(", ") + ")"
  if t.functionType?
    return dumpType(t.argType) + " -> " + dumpType(t.functionType)
  if t.templateType?
    return t.templateType + "(" + t.parameters.map(dumpType).join(", ") + ")"
  if t.disjointType?
    types = t.disjointType.map (x) -> if x.functionType? then "(" + dumpType(x) + ")" else dumpType(x)
    return types.join(" | ")
  if t.parameterType?
    return "$" + t.parameterType
  return "???(#{util.inspect(t)})"

dumpNamedType = (t) ->
  type = if t.type? then ": " + dumpType(t.type) else ""
  value = if t.value? then " = " + d_expr.dumpExpr(t.value) else ""
  t.name + type + value


exports.dumpType = dumpType
