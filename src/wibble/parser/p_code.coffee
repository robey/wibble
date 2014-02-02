pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
p_expr = require './p_expr'
p_type = require './p_type'

blockOf = p_common.blockOf
commaSeparatedSurrounded = p_common.commaSeparatedSurrounded
compoundType = p_type.compoundType
expression = p_expr.expression
linespace = p_common.linespace
symbolRef = p_const.symbolRef
SYMBOL_NAME = p_common.SYMBOL_NAME
toState = p_common.toState
typedecl = p_type.typedecl
whitespace = p_common.whitespace

#
# parse code
#

functionx = pr([ compoundType.optional(compoundType: []), linespace, toState("->"), whitespace, (-> expression) ]).onMatch (m, state) ->
  { parameters: m[0], functionx: m[2], state: m[1] }

# preserve location of name
localName = pr(SYMBOL_NAME).onMatch (m, state) -> { name: m[0], state }

localVal = pr([ toState("val"), linespace, localName, linespace, pr("=").drop(), linespace, (-> expression) ]).onMatch (m, state) ->
  { local: m[1], value: m[2], state: m[0] }

handlerReceiver = pr.alt(symbolRef, compoundType).describe("symbol or parameters")

handler = pr([ toState("on"), linespace, handlerReceiver, linespace, pr("->").drop(), whitespace, expression ]).onMatch (m, state) ->
  { on: m[1], handler: m[2], state: m[0] }

code = pr.alt(localVal, handler, expression).onFail("Expected declaration or expression")

codeBlock = blockOf(code).onMatch (m, state) ->
  { code: m, state: state }


exports.code = code
exports.codeBlock = codeBlock
exports.functionx = functionx