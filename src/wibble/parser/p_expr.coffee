pr = require 'packrattle'
util = require 'util'
p_code = require './p_code'
p_common = require './p_common'
p_const = require './p_const'

codeBlock = -> p_code.codeBlock
commentspace = p_common.commentspace
constant = p_const.constant
functionx = -> p_code.functionx
linespace = p_common.linespace
repeatSurrounded = p_common.repeatSurrounded
RESERVED = p_common.RESERVED
SYMBOL_NAME = p_common.SYMBOL_NAME
toState = p_common.toState
whitespace = p_common.whitespace

#
# parse expressions
#

# { reference: "" }
reference = pr(SYMBOL_NAME).matchIf((m) -> RESERVED.indexOf(m[0]) < 0).onMatch (m, state) ->
  { reference: m[0], state }

# { array: [] }
arrayExpr = repeatSurrounded(
  pr("[").commit(),
  (-> expression),
  /[\n,]+/,
  pr("]").commit(),
  commentspace,
  "Expected array item"
).onMatch (m, state) ->
  rv = { array: m.items, state }
  if m.trailingComment? then rv.trailingComment = m.trailingComment
  rv

structMember = pr([ pr([ SYMBOL_NAME, pr(/\s*=\s*/).drop() ]).optional([]), (-> expression) ]).onMatch (m, state) ->
  if m[0].length > 0
    { name: m[0][0][0], value: m[1], state: state }
  else
    { value: m[1], state: state }

struct = repeatSurrounded("(", structMember, /[\n,]+/, ")", commentspace, "Expected struct item").onMatch (m, state) ->
  # AST optimization: "(expr)" is just a precedence-bumped expression.
  if m.items.length == 1 and (not m.items[0].name?) then return m.items[0].value
  rv = { struct: m.items, state }
  if m.trailingComment? then rv.trailingComment = m.trailingComment
  rv

newObject = pr([ toState("new"), whitespace, codeBlock ]).onMatch (m, state) ->
  { newObject: m[1], state: m[0] }

atom = pr.alt(constant, reference, arrayExpr, functionx, struct, codeBlock, newObject).describe("atom")

unary = pr.alt([ pr(/(\+|-(?!>)|not)/).commit(), whitespace, (-> unary) ], [ atom ]).describe("unary").onMatch (m, state) ->
  if m.length > 1
    { unary: m[0][0], right: m[1], state }
  else
    m[0]

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
  toState("if")
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
  if m[3].length > 0
    { condition: m[1], ifThen: m[2], ifElse: m[3][0], state: m[0] }
  else
    { condition: m[1], ifThen: m[2], state: m[0] }

baseExpression = pr.alt(condition, logical)

postfixUnless = pr([ toState("unless"), linespace, -> expression ]).onMatch (m, state) -> { unless: m[1], state: m[0] }
postfixUntil = pr([ toState("until"), linespace, -> expression ]).onMatch (m, state) -> { until: m[1], state: m[0] }

expression = pr([ baseExpression, pr([ linespace, pr.alt(postfixUnless, postfixUntil) ]).optional([]) ]).describe("expression").onMatch (m, state) ->
  # pass thru raw expression if there were no postfixes
  if m[1].length == 0 then return m[0]
  m[1][0].nested = m[0]
  m[1][0]


exports.expression = expression
