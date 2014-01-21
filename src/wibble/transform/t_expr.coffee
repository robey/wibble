util = require 'util'
t_error = require './t_error'

# traverse an expression tree, sending each expression object through the
# 'transform' function.
# transform(expr, state, copy) -> [ newExpr, newState ]
digExpr = (expr, state, transform) ->
  dig = (e) -> digExpr(e, state, transform)

  # FIXME should be elsewhere, probably
  copy = (changes) ->
    rv = {}
    for k, v of expr then rv[k] = v
    for k, v of changes then rv[k] = v
    Object.freeze(rv)

  if not expr? then return expr
  rv = transform(expr, state, copy)
  [ expr, state ] = if Array.isArray(rv) then rv else [ rv, state ]

  if expr.array? then return copy(array: expr.array.map(dig))
  if expr.struct? then return copy(struct: expr.struct.map (s) -> { name: s.name, expression: dig(s.expression) })
  if expr.unary? then return copy(unary: expr.unary, right: dig(expr.right))
  if expr.call? then return copy(call: dig(expr.call), arg: dig(expr.arg))
  if expr.binary? then return copy(binary: expr.binary, left: dig(expr.left), right: dig(expr.right))
  if expr.condition? then return copy(condition: dig(expr.condition), ifThen: dig(expr.ifThen), ifElse: dig(expr.ifElse))
  if expr.functionx?
    parameters = expr.parameters?.map (p) -> { name: p.name, type: p.type, value: (if p.value? then dig(p.value) else null) }
    return copy(functionx: dig(expr.functionx), parameters: parameters)
  if expr.local? then return copy(value: dig(expr.value))
  if expr.code? then return copy(code: expr.code.map(dig))
  if expr.on? then return copy(handler: dig(expr.handler))
  expr

# turn all binary/unary expressions into calls.
flattenInfix = (expr) ->
  digExpr expr, {}, (expr, state, copy) ->
    if not (expr.binary? or expr.unary?) then return expr
    if expr.binary?
      copy(binary: null, call: { call: expr.left, arg: { symbol: expr.binary } }, arg: expr.right)
    else if expr.unary?
      op = switch expr.unary
        when "+" then "positive"
        when "-" then "negative"
        else expr.unary
      copy(unary: null, call: { call: expr.right, arg: { symbol: op } }, arg: { nothing: true })

transformExpr = (expr) ->
  expr = flattenInfix(expr)
  expr


exports.digExpr = digExpr
exports.flattenInfix = flattenInfix
exports.transformExpr = transformExpr
