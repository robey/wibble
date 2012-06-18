parser = require("packrattle")

opList = [
  "**", "*", "/", "%", "+", "-", "<<", ">>", "==", "!=", ">=", "<=", ">", "<"
]
keywords = [ "then", "else", "match", "true", "false", "is" ]

# expression:
# - symbol
# - number / value
# - boolean
# - unit
# - opref
# - struct
# call: (arg)
# unary: (right)
# binary: (left, right)
# code: (params)

parser.setWhitespace /([ ]+|\\\n)+/

NAME = /[A-Za-z_][A-Za-z_0-9]*/

symbol = parser.regex(NAME).matchIf((m) -> keywords.indexOf(m[0]) < 0).onMatch (m) ->
  { symbol: m[0] }

# FIXME hex notation.
number = parser.regex(/-?[0-9]+(\.[0-9]+)?(L?)/).onMatch (m) ->
  hasDot = m[0].indexOf(".") >= 0
  if m[2] == "L"
    { number: (if hasDot then "long-real" else "long-int"), value: m[0].slice(0, m[0].length - 1) }
  else
    { number: (if hasDot then "real" else "int"), value: m[0] }

boolean = parser.regex(/true|false/).onMatch (m) -> { boolean: m[0] == "true" }

unit = parser.string("()").onMatch (x) -> { unit: true }

opref = parser.seq(parser.drop(":"), opList.reduce((a, b) -> parser.implicit(a).or(b))).onMatch (x) ->
  { opref: x[0] }

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
  { struct: x[0] }

struct = structWithNames.or(structWithoutNames)

atom1 = boolean.or(-> xfunction).or(struct).or(-> block).or(symbol).or(number).or(unit).or(opref).or(symbolref).onFail("atom")

unary = parser.seq(parser.string("-").drop(), atom1).onMatch (x) ->
  { unary: "-", right: x[0] }

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

#####

LF = /(\s*\n)+/

parameter = parser.seq(
  NAME
  parser.drop(":")
  NAME
  parser.seq(parser.drop("="), expression).optional([])
).onMatch (x) -> { name: x[0][0], type: x[1][0], value: x[2][0] }

parameterList = parameter.repeat(",")

functionParameters = parser.seq(
  parser.drop("(")
  parameterList
  parser.drop(")")
  parser.drop("->")
).onMatch (x) -> x[0]

local = parser.seq(
  parser.drop("val")
  NAME
  parser.drop("=")
  expression
).onMatch (x) -> { local: x[0][0], value: x[1] }

blockCode = local.or(expression).onFail("Expected local or expression")

xfunction = parser.seq(
  functionParameters.or(parser.string("->").onMatch((x) -> []))
  expression
).onMatch (x) ->
  { params: x[0], body: x[1] }

block = parser.seq(
  parser.drop("{")
  parser.optional(LF).drop()
  blockCode.repeat(/\n|;/).optional()
  parser.optional(LF).drop()
  parser.drop("}")
).onMatch (x) ->
  { code: x[0] }


#      try {
#        val expr = parser.parseExpression(line)
#        val rv = runtime.apply(expr, globals)
#        out.print("\u2604 ")
#        out.print("[")
#        out.print(rv.`type`.toDebug)
#        out.print("] ")
#        out.print(rv.toDebug)
#        out.print("\n\n")
#      } catch {
#        case e: ParseException => out.println(e)
#        case e: Runtime.WException => out.println("\u2639\u2639\u2639 " + e.getMessage)
#      }

