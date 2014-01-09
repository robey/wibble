util = require 'util'
misc = require '../misc'
p_common = require '../parser/p_common'

OPERATORS = p_common.OPERATORS
PRECEDENCE = p_common.PRECEDENCE
RESERVED = p_common.RESERVED

#
# dump types
#

dumpType = (t) ->
  if t.type? then return t.type
  if t.namedType? then return "#{t.name}: #{dumpType(t.namedType)}"
  if t.compoundType?
    return "(" + t.compoundType.map(dumpType).join(", ") + ")"
  if t.functionType?
    return dumpType(t.argType) + " -> " + dumpType(t.functionType)
  if t.templateType?
    return t.templateType + "(" + t.parameters.map(dumpType).join(", ") + ")"
  return "???(#{util.inspect(t)})"


exports.dumpType = dumpType
