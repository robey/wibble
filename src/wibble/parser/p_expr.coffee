pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'
misc = require '../misc'

commaSeparated = p_common.commaSeparated
constant = p_const.constant

#
# parse expressions
#

# { array: [] }
arrayExpr = pr([ pr(/\[\s*/).drop(), commaSeparated(-> expression), pr(/\s*\]/).drop() ]).onMatch (m) ->
  { array: m[0].map (x) -> x[0] }

# { map: [ [name, _] ] }
mapItem = pr([ (-> expression), pr(/\s*:\s*/).drop(), (-> expression) ])
mapExpr = pr([ pr(/\{\s*/).drop(), commaSeparated(mapItem), pr(/\s*\}/).drop() ]).onMatch (m) ->
  { map: m[0].map (x) -> x[0] }

atom1 = pr.alt(constant, arrayExpr, mapExpr)

# atom1 = pr.alt(constant, (-> func), struct, (-> block))


# unary = parser.seq(parser.string("-").drop(), atom1).onMatch (x) ->
#   { unary: "negate", right: x[0] }

# atom = atom1.or(unary)

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

expression = atom1

exports.expression = expression
