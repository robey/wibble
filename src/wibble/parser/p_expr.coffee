pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_const = require './p_const'

commaSeparated = p_common.commaSeparated
commaSeparatedSurrounded = p_common.commaSeparatedSurrounded
constant = p_const.constant
linespace = p_common.linespace
SYMBOL_NAME = p_common.SYMBOL_NAME
whitespace = p_common.whitespace

#
# parse expressions
#

# { array: [] }
arrayExpr = commaSeparatedSurrounded("[", (-> expression), "]", "Expected array item").onMatch (m) ->
  { array: m }

# { map: [ [name, _] ] }
mapItem = pr([ (-> expression), pr(/\s*:\s*/).drop(), (-> expression) ])
mapExpr = commaSeparatedSurrounded("{", mapItem, "}", "Expected map item").onMatch (m) ->
  { map: m }

structMember = pr([ pr([ SYMBOL_NAME, pr(/\s*=\s*/).drop() ]).optional([]), (-> expression) ]).onMatch (m) ->
  if m[0].length > 0
    { name: m[0][0][0], expression: m[1] }
  else
    { expression: m[1] }

struct = commaSeparatedSurrounded("(", structMember, ")", "Expected struct item").onMatch (m) ->
  # AST optimization: "(expr)" is just a precedence-bumped expression.
  if m.length == 1 and (not m[0].name?) then return m[0].expression
  { struct: m }

# FIXME: func, block
atom = pr.alt(constant, arrayExpr, mapExpr, struct).describe("atom")

unary = pr([ pr([ pr.alt("+", "-", "not"), whitespace ]).optional([]), atom ]).describe("unary").onMatch (m) ->
  if m[0].length > 0
    { unary: m[0][0], right: m[1] }
  else
    m[1]

call = pr([ unary, pr.repeatIgnore(linespace, atom) ]).onMatch (m) ->
  [ m[0] ].concat(m[1]).reduce (x, y) -> { call: x, arg: y }

# helper
binary = (subexpr, op) ->
  op = pr(op)
  sep = pr([ linespace, op, linespace ]).onMatch (m) -> m[0]
  pr.reduce(
    subexpr,
    sep,
    accumulator=((x) -> x),
    reducer=((left, op, right) -> { binary: op, left: left, right: right })
  ).describe("binary(#{op.message()})")

power = binary(call, "**")
factor = binary(power, pr.alt("*", "/", "%"))
term = binary(factor, pr.alt("+", "-"))
shifty = binary(term, pr.alt("<<", ">>"))
comparison = binary(shifty, pr.alt("==", ">=", "<=", "!=", "<", ">"))
logical = binary(comparison, pr.alt("and", "or"))

condition = pr([
  pr("if").drop()
  linespace
  -> expression
  linespace
  pr("then").drop()
  linespace
  -> expression
  pr([
    linespace
    pr("else").drop()
    linespace
    -> expression
  ]).optional([])
]).describe("condition").onMatch (m) ->
  if m[2].length > 0
    { condition: m[0], ifThen: m[1], ifElse: m[2][0] }
  else
    { condition: m[0], ifThen: m[1] }

expression = pr.alt(condition, logical).onFail("Expected expression")

exports.expression = expression
