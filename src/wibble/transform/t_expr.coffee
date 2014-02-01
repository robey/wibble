util = require 'util'
t_common = require './t_common'

# traverse an expression tree, sending each expression object through the
# 'transform' function before diving deeper.
# transform(expr, state, copy) -> [ newExpr, newState ]
digExpr = (expr, state, transform) ->
  dig = (e) -> digExpr(e, state, transform)

  # FIXME should be elsewhere, probably
  copy = (changes) ->
    rv = {}
    for k, v of expr when changes[k] != null then rv[k] = v
    for k, v of changes then rv[k] = v
    Object.freeze(rv)

  if not expr? then return expr
  rv = transform(expr, state, copy)
  [ expr, state ] = if Array.isArray(rv) then rv else [ rv, state ]

  if expr.array? then return copy(array: expr.array.map(dig))
  if expr.struct? then return copy(struct: expr.struct.map (s) -> { name: s.name, value: dig(s.value) })
  if expr.unary? then return copy(unary: expr.unary, right: dig(expr.right))
  if expr.call? then return copy(call: dig(expr.call), arg: dig(expr.arg))
  if expr.binary? then return copy(binary: expr.binary, left: dig(expr.left), right: dig(expr.right))
  if expr.condition? then return copy(condition: dig(expr.condition), ifThen: dig(expr.ifThen), ifElse: dig(expr.ifElse))
  if expr.functionx? then return copy(functionx: dig(expr.functionx), parameters: digType(expr.parameters, state, transform))
  if expr.newObject? then return copy(newObject: dig(expr.newObject))

  if expr.local? then return copy(value: dig(expr.value))
  if expr.code? then return copy(code: expr.code.map(dig))
  if expr.on?
    newOn = if expr.on.compoundType? then digType(expr.on) else expr.on
    return copy(on: newOn, handler: dig(expr.handler))
  expr

digType = (t, state, transform) ->
  if t.compoundType?
    parameters = t.compoundType.map (p) ->
      { name: p.name, type: p.type, value: if p.value? then digExpr(p.value, state, transform) else undefined }
    return { compoundType: parameters }
  t

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


exports.digExpr = digExpr
exports.flattenInfix = flattenInfix
