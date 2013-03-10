parser = require("packrattle")

opList = [
  "**", "*", "/", "%", "+", "-", "<<", ">>", "==", "!=", ">=", "<=", ">", "<"
]
keywords = [ "then", "else", "match", "true", "false", "is", "on", "val", "def", "prototype" ]

# or, and

# expression:
# - symbol
# - number (value)
# - boolean
# - unit
# - struct
# call: (arg)
# unary: (right) *
# binary: (left, right) *
# condition: (ifThen, ifElse)
# code
# local: (value)
# func: (params)
# on: (handler)
# method: (params, body) *
#
# proto: (params, body)
#
# * eliminated through transforms

parser.setWhitespace /([ ]+|\\\n)+/

NAME = /[A-Za-z_][A-Za-z_0-9]*/

symbol = parser.regex(NAME).matchIf((m) -> keywords.indexOf(m[0]) < 0).onMatch (m) ->
  { symbol: m[0] }

# FIXME hex notation.
# FIXME binary notation.
number = parser.regex(/-?[0-9]+(\.[0-9]+)?(L?)/).onMatch (m) ->
  hasDot = m[0].indexOf(".") >= 0
  if m[2] == "L"
    { number: (if hasDot then "long-real" else "long-int"), value: m[0].slice(0, m[0].length - 1) }
  else
    { number: (if hasDot then "real" else "int"), value: m[0] }

boolean = parser.regex(/true|false/).onMatch (m) -> { boolean: m[0] == "true" }

unit = parser.string("()").onMatch (x) -> { unit: true }

opref = parser.seq(parser.drop(":"), opList.reduce((a, b) -> parser.implicit(a).or(b))).onMatch (x) ->
  { symbol: x[0] }

symbolref = parser.seq(parser.drop(":"), NAME).onMatch (m) ->
  { symbol: m[0][0] }

namedExpression = parser.seq(NAME, parser.drop("="), -> expression).onMatch (x) ->
  { name: x[0][0], expression: x[1] }

structWithNames = parser.seq(
  parser.drop("(")
  namedExpression.repeat(",")
  parser.drop(")")
).onMatch (x) ->
  { struct: x[0] }

structWithoutNames = parser.seq(
  parser.drop("(")
  -> expression.repeat(",")
  parser.drop(")")
).onMatch (x) ->
  # quick AST optimization: "(expr)" is just a precedence-bumped expression.
  if x[0].length == 1 then return x[0][0]
  { struct: x[0].map((x) -> { expression: x }) }

struct = structWithNames.or(structWithoutNames)

# FIXME: array / map / string constants? :)
constant = boolean.or(number).or(unit).or(symbol).or(symbolref).onFail("constant")

atom1 = constant.or(-> xfunction).or(struct).or(-> block).or(opref).onFail("atom")

unary = parser.seq(parser.string("-").drop(), atom1).onMatch (x) ->
  { unary: "negate", right: x[0] }

atom = atom1.or(unary)

call = atom.then(atom1.repeat().optional([])).onMatch (x) ->
  [ x[0] ].concat(x[1]).reduce (x, y) -> { call: x, arg: y }

# helper
binary = (subexpr, op) ->
  parser.foldLeft(
    tail: subexpr
    sep: parser.implicit(op)
    accumulator: (x) -> x
    fold: (left, op, right) -> { binary: op, left: left, right: right }
  )

power = binary(call, "**")
factor = binary(power, parser.string("*").or("/").or("%"))
term = binary(factor, parser.string("+").or("-"))
shifty = binary(term, parser.string("<<").or(">>"))
comparison = binary(shifty, parser.string("==").or(">=").or("<=").or("!=").or("<").or(">").or("is").or("is not"))
condition = parser.seq(
  parser.drop("if")
  -> expression
  parser.drop("then")
  -> expression
  parser.optional([ parser.drop("else"), -> expression ], [])
).onMatch (x) ->
  if x[2].length > 0
    { condition: x[0], ifThen: x[1], ifElse: x[2][0] }
  else
    { condition: x[0], ifThen: x[1] }

expression = condition.or(comparison).onFail("Expected expression")
exports.expression = expression

##### inline functions

LF = /(\s*\n)+/

parameter = parser.seq(
  NAME
  parser.drop(":")
  NAME
  parser.seq(parser.drop("="), expression).optional([])
).onMatch (x) -> { name: x[0][0], type: x[1][0], value: x[2][0] }

functionParameters = parser.seq(
  parser.drop("(")
  parameter.repeat(",").optional([])
  parser.drop(")")
).onMatch (x) -> x[0]

local = parser.seq(
  parser.drop("val")
  NAME
  parser.drop("=")
  expression
).onMatch (x) -> { local: x[0][0], value: x[1] }

method = parser.seq(
  parser.drop("def"),
  symbol.or(opref).or(symbolref),
  functionParameters,
  parser.drop("="),
  expression
).onMatch (x) ->
  { method: x[0].symbol, params: x[1], body: x[2] }

blockCode = local.or(method).or(expression).onFail("Expected local or expression")
exports.blockCode = blockCode

xfunction = parser.seq(
  functionParameters.optional([])
  parser.drop("->")
  expression
).onMatch (x) ->
  { params: x[0], func: x[1] }

# list of expressions matching 'p' that are inside a { } block
blockOf = (p) ->
  parser.seq(
    parser.drop("{")
    parser.optional(LF).drop()
    p.repeat(/\n|;/).optional([])
    parser.optional(LF).drop()
    parser.drop("}")
  ).onMatch (x) -> x[0]

block = blockOf(blockCode).onMatch (x) ->
  { code: x }

##### prototype

protoParameter = parser.seq(
  parser.optional("@")
  NAME
  parser.drop(":")
  NAME
  parser.seq(parser.drop("="), expression).optional([])
).onMatch (x) -> { local: x[0], name: x[1][0], type: x[2][0], value: x[3][0] }

protoParameters = parser.seq(
  parser.drop("(")
  protoParameter.repeat(",").optional([])
  parser.drop(")")
).onMatch (x) -> x[0]

handler = parser.seq(
  parser.drop("on"),
  symbol.or(functionParameters.onMatch (x) -> { params: x }),
  parser.drop("->"),
  expression
).onMatch (x) ->
  { on: x[0], handler: x[1] }

protoCode = handler.or(local).or(expression).onFail("Expected expression or handler")

proto = parser.seq(
  parser.drop("prototype")
  symbol
  protoParameters.optional([])
  blockOf(protoCode)
).onMatch (x) ->
  { proto: x[0].symbol, params: x[1], body: x[2] }

exports.proto = proto

exports.repl = proto.or(blockCode)
