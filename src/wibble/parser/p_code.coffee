pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
p_expr = require './p_expr'
p_type = require './p_type'

blockOf = p_common.blockOf
compoundType = p_type.compoundType
expression = p_expr.expression
internalSymbolRef = p_const.internalSymbolRef
linespace = p_common.linespace
symbolRef = p_const.symbolRef
SYMBOL_NAME = p_common.SYMBOL_NAME
toState = p_common.toState
typedecl = p_type.typedecl
whitespace = p_common.whitespace

#
# parse code
#

functionx = pr([
  compoundType.optional(compoundType: [])
  linespace
  pr([ pr(":").drop(), linespace, typedecl, linespace ]).optional([])
  toState("->")
  whitespace
  (-> expression)
]).onMatch (m, state) ->
  { parameters: m[0], functionx: m[3], type: m[1][0], state: m[2] }

# preserve location of name
localName = pr(SYMBOL_NAME).onMatch (m, state) -> { name: m[0], state }

localVal = pr([
  pr([ "mutable", linespace ]).optional([])
  localName
  linespace
  pr("=").commit().drop()
  linespace
  (-> expression)
]).onMatch (m, state) ->
  { local: m[1], value: m[2], mutable: m[0].length > 0, state: m[1].state }

assignment = pr([ localName, linespace, toState(":="), linespace, (-> expression) ]).onMatch (m, state) ->
  { assignment: m[0].name, value: m[2], state: m[1] }

handlerReceiver = pr.alt(symbolRef, internalSymbolRef, compoundType).describe("symbol or parameters")

handler = pr([ toState("on"), linespace, handlerReceiver, linespace, pr("->").drop(), whitespace, expression ]).onMatch (m, state) ->
  { on: m[1], handler: m[2], state: m[0] }

returnEarly = pr([ toState("return"), linespace, expression ]).onMatch (m, state) ->
  { returnEarly: m[1], state: m[0] }

code1 = pr.alt(localVal, assignment, handler, returnEarly, expression).onFail("Expected declaration or expression")

code = pr([ whitespace, code1 ]).onMatch (m) -> m[0]

codeBlock = blockOf(code).onMatch (m, state) ->
  rv = { code: m.items, state: state }
  if m.trailingComment? then rv.trailingComment = m.trailingComment
  rv


exports.code = code
exports.codeBlock = codeBlock
exports.functionx = functionx
