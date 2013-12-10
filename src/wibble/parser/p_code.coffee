pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
p_expr = require './p_expr'
p_type = require './p_type'

blockOf = p_common.blockOf
commaSeparatedSurrounded = p_common.commaSeparatedSurrounded
expression = p_expr.expression
linespace = p_common.linespace
SYMBOL_NAME = p_common.SYMBOL_NAME
typedecl = p_type.typedecl

#
# parse code
#

parameter = pr([
  SYMBOL_NAME
  pr([ linespace, pr(":").drop(), linespace, typedecl ]).optional([])
  pr([ linespace, pr("=").drop(), linespace, (-> expression) ]).optional([])
]).onMatch (m) ->
  { name: m[0][0], type: m[1][0], value: m[2][0] }

parameterList = commaSeparatedSurrounded("(", parameter, ")", "Expected function parameter")

functionx = pr([ parameterList.optional([]), linespace, pr("->").commit().drop(), linespace, (-> expression) ]).onMatch (m) ->
  { parameters: m[0], functionx: m[1] }

localVal = pr([ pr("val").commit().drop(), linespace, SYMBOL_NAME, linespace, pr("=").drop(), linespace, (-> expression) ]).onMatch (m) ->
  { local: m[0][0], value: m[1] }

code = pr.alt(localVal, expression).onFail("Expected declaration or expression")

codeBlock = blockOf(code).onMatch (m) ->
  { code: m }


exports.code = code
exports.codeBlock = codeBlock
exports.functionx = functionx
