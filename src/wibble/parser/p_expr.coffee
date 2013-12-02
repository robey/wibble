pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
misc = require '../misc'

commaSeparated = p_common.commaSeparated
constant = p_const.constant
SYMBOL_NAME = p_common.SYMBOL_NAME
whitespace = p_common.whitespace

#
# parse expressions
#

# { array: [] }
arrayExpr = pr([ pr(/\[\s*/).drop(), commaSeparated(-> expression), pr(/\s*\]/).drop() ]).onMatch (m) ->
  { array: m[0] }

# { map: [ [name, _] ] }
mapItem = pr([ (-> expression), pr(/\s*:\s*/).drop(), (-> expression) ])
mapExpr = pr([ pr(/\{\s*/).drop(), commaSeparated(mapItem), pr(/\s*\}/).drop() ]).onMatch (m) ->
  { map: m[0] }

structMember = pr([ pr([ SYMBOL_NAME, pr(/\s*=\s*/).drop() ]).optional([]), (-> expression) ]).onMatch (m) ->
  if m[0].length > 0
    { name: m[0][0][0], expression: m[1] }
  else
    { expression: m[1] }

struct = pr([ pr(/\(\s*/).drop(), commaSeparated(structMember), pr(/\s*\)/).drop() ]).onMatch (m) ->
  # AST optimization: "(expr)" is just a precedence-bumped expression.
  if m[0].length == 1 and (not m[0][0].name?) then return m[0][0].expression
  { struct: m[0] }



atom = pr.alt(constant, arrayExpr, mapExpr, struct)

unary = pr([ pr([ pr.alt("-", "not"), whitespace ]).optional([]), atom ]).onMatch (m) ->
  if m[0].length > 0
    { unary: m[0][0], right: m[1] }
  else
    m[1]



# atom1 = pr.alt(constant, (-> func), struct, (-> block))



# call = atom.then(atom1.repeat().optional([])).onMatch (x) ->
#   [ x[0] ].concat(x[1]).reduce (x, y) -> { call: x, arg: y }

# # helper
# binary = (subexpr, op) ->
#   parser.reduce(
#     tail: subexpr
#     sep: parser.implicit(op)
#     accumulator: (x) -> x
#     fold: (left, op, right) -> { binary: op, left: left, right: right }
#   )

# power = binary(call, "**")
# factor = binary(power, parser.string("*").or("/").or("%"))
# term = binary(factor, parser.string("+").or("-"))
# shifty = binary(term, parser.string("<<").or(">>"))
# comparison = binary(shifty, parser.string("==").or(">=").or("<=").or("!=").or("<").or(">").or("is").or("is not"))
# condition = parser.seq(
#   parser.drop("if")
#   -> expression
#   parser.drop("then")
#   -> expression
#   parser.optional([ parser.drop("else"), -> expression ], [])
# ).onMatch (x) ->
#   if x[2].length > 0
#     { condition: x[0], ifThen: x[1], ifElse: x[2][0] }
#   else
#     { condition: x[0], ifThen: x[1] }

# expression = condition.or(comparison).onFail("Expected expression")

expression = unary

exports.expression = expression
