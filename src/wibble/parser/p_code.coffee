pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
p_expr = require './p_expr'
p_type = require './p_type'

commaSeparatedSurrounded = p_common.commaSeparatedSurrounded
expression = p_expr.expression
linespace = p_common.linespace
SYMBOL_NAME = p_common.SYMBOL_NAME
typedecl = p_type.typedecl


# commaSeparated = p_common.commaSeparated
# constant = p_const.constant
# whitespace = p_common.whitespace

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


exports.functionx = functionx


# local = parser.seq(
#   parser.drop("val")
#   NAME
#   parser.drop("=")
#   expression
# ).onMatch (x) -> { local: x[0][0], value: x[1] }

# method = parser.seq(
#   parser.drop("def"),
#   symbol.or(opref).or(symbolref),
#   functionParameters,
#   parser.drop("="),
#   expression
# ).onMatch (x) ->
#   { method: x[0].symbol, params: x[1], body: x[2] }

# blockCode = local.or(method).or(expression).onFail("Expected local or expression")
# exports.blockCode = blockCode
