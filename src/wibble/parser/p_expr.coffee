pr = require 'packrattle'
util = require 'util'
p_code = require './p_code'
p_common = require './p_common'
p_const = require './p_const'

codeBlock = -> p_code.codeBlock
commaSeparated = p_common.commaSeparated
commaSeparatedSurrounded = p_common.commaSeparatedSurrounded
commaSeparatedSurroundedCommit = p_common.commaSeparatedSurroundedCommit
constant = p_const.constant
functionx = -> p_code.functionx
linespace = p_common.linespace
RESERVED = p_common.RESERVED
SYMBOL_NAME = p_common.SYMBOL_NAME
whitespace = p_common.whitespace

#
# parse expressions
#

# { reference: "" }
reference = pr(SYMBOL_NAME).matchIf((m) -> RESERVED.indexOf(m[0]) < 0).onMatch (m, state) ->
  { reference: m[0], state }

# { array: [] }
arrayExpr = commaSeparatedSurroundedCommit("[", (-> expression), "]", "Expected array item").onMatch (m, state) ->
  { array: m, state }

structMember = pr([ pr([ SYMBOL_NAME, pr(/\s*=\s*/).drop() ]).optional([]), (-> expression) ]).onMatch (m, state) ->
  if m[0].length > 0
    { name: m[0][0][0], expression: m[1], state }
  else
    { expression: m[1], state }

struct = commaSeparatedSurrounded("(", structMember, ")", "Expected struct item").onMatch (m, state) ->
  # AST optimization: "(expr)" is just a precedence-bumped expression.
  if m.length == 1 and (not m[0].name?) then return m[0].expression
  { struct: m, state }

atom = pr.alt(constant, reference, arrayExpr, struct, functionx, codeBlock).describe("atom")

unary = pr([ pr([ pr.alt("+", "-", "not"), whitespace ]).optional([]), atom ]).describe("unary").onMatch (m, state) ->
  if m[0].length > 0
    { unary: m[0][0], right: m[1], state }
  else
    m[1]

call = pr([ unary, pr.repeatIgnore(linespace, atom.onMatch((m, state) -> { atom: m, state: state })) ]).onMatch (m, state) ->
  [ m[0] ].concat(m[1]).reduce (x, y) -> { call: x, arg: y.atom, state: y.state.backfill(x.state) }

# helper
binary = (subexpr, op) ->
  op = pr(op)
  sep = pr([ whitespace, op, whitespace ]).commit().onMatch (m) -> m[0]
  pr.reduce(
    pr(subexpr).onFail("Expected operand")#.onMatch((m, state) -> { operand: m, state: state }),
    sep,
    ((x) -> x),
    ((left, op, right) -> { binary: op, left: left, right: right, state: right.state.backfill(left.state) })
  ).describe("binary(#{op.description()})")

power = binary(call, "**")
factor = binary(power, pr.alt("*", "/", "%"))
term = binary(factor, pr.alt("+", "-"))
shifty = binary(term, pr.alt("<<", ">>"))
comparison = binary(shifty, pr.alt("==", ">=", "<=", "!=", "<", ">"))
logical = binary(comparison, pr.alt("and", "or"))

condition = pr([
  pr("if").commit().drop()
  linespace
  -> expression
  linespace
  pr("then").commit().drop()
  linespace
  -> expression
  pr([
    linespace
    pr("else").commit().drop()
    linespace
    -> expression
  ]).optional([])
]).describe("condition").onMatch (m, state) ->
  if m[2].length > 0
    { condition: m[0], ifThen: m[1], ifElse: m[2][0], state }
  else
    { condition: m[0], ifThen: m[1], state }

expression = pr.alt(condition, logical).describe("expression")


exports.expression = expression
