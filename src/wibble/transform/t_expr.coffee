util = require 'util'
t_common = require './t_common'

copy = t_common.copy
error = t_common.error

# traverse an expression tree, sending each expression object through the
# 'transform' function before diving deeper.
# transform(expr, state) -> [ newExpr, newState ]
digExpr = (expr, state, transform) ->
  dig = (e) -> digExpr(e, state, transform)

  if not expr? then return expr
  rv = transform(expr, state)
  [ expr, state ] = if Array.isArray(rv) then rv else [ rv, state ]

  if expr.array? then return copy(expr, array: expr.array.map(dig))
  if expr.struct? then return copy(expr, struct: expr.struct.map (s) -> copy(s, value: dig(s.value)))
  if expr.unary? then return copy(expr, unary: expr.unary, right: dig(expr.right))
  if expr.call? then return copy(expr, call: dig(expr.call), arg: dig(expr.arg))
  if expr.binary? then return copy(expr, binary: expr.binary, left: dig(expr.left), right: dig(expr.right))
  if expr.condition? then return copy(expr, condition: dig(expr.condition), ifThen: dig(expr.ifThen), ifElse: dig(expr.ifElse))
  if expr.functionx? then return copy(expr, functionx: dig(expr.functionx), parameters: digType(expr.parameters, state, transform))
  if expr.newObject? then return copy(expr, newObject: dig(expr.newObject))

  if expr.local? then return copy(expr, value: dig(expr.value))
  if expr.code? then return copy(expr, code: expr.code.map(dig))
  if expr.on?
    newOn = if expr.on.compoundType? then digType(expr.on, state, transform) else expr.on
    return copy(expr, on: newOn, handler: dig(expr.handler))
  expr

digType = (t, state, transform) ->
  if t.compoundType?
    parameters = t.compoundType.map (p) ->
      copy(p, value: if p.value? then digExpr(p.value, state, transform) else undefined)
    return copy(t, compoundType: parameters)
  t

# turn all binary/unary expressions into calls.
flattenInfix = (expr) ->
  digExpr expr, {}, (expr, state) ->
    if not (expr.binary? or expr.unary?) then return expr
    if expr.binary?
      copy(expr, binary: null, call: { call: expr.left, arg: { symbol: expr.binary } }, arg: expr.right)
    else if expr.unary?
      op = switch expr.unary
        when "+" then "positive"
        when "-" then "negative"
        else expr.unary
      copy(expr, unary: null, call: { call: expr.right, arg: { symbol: op } }, arg: { nothing: true })

normalizeIf = (expr) ->
  digExpr expr, {}, (expr, state) ->
    if expr.condition? and not expr.ifElse?
      return copy(expr, ifElse: { nothing: true })
    return expr

# turn all positional fields into named fields
normalizeStruct = (expr) ->
  digExpr expr, {}, (expr, state) ->
    if not expr.struct? then return expr
    fields = []
    positional = true
    seen = {}
    for arg, i in expr.struct
      if not arg.name
        if not positional then error("Positional fields can't come after named fields", arg.state)
        fields.push { name: "?#{i}", value: arg.value }
      else
        positional = false
        if seen[arg.name] then error("Field name #{arg.name} is repeated", arg.state)
        seen[arg.name] = true
        fields.push { name: arg.name, value: arg.value }
    return copy(expr, struct: fields)


exports.digExpr = digExpr
exports.flattenInfix = flattenInfix
exports.normalizeIf = normalizeIf
exports.normalizeStruct = normalizeStruct
