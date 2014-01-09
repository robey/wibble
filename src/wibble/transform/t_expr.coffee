util = require 'util'

# traverse an expression, looking for objects where 'match(obj)' returns
# true. for those, replace the object with whatever is returned by
# 'transform(obj)'. for the rest, leave them alone. for all objects, nested
# expressions are recursively dug.
digExpr = (expr, match, transform) ->
  if not expr? then return expr
  dig = (x) -> digExpr(x, match, transform)

  if match(expr) then expr = transform(expr)

  if expr.array? then return { array: expr.array.map(dig) }
  if expr.struct? then return { struct: expr.struct.map (s) -> { name: s.name, expression: dig(s.expression) } }
  if expr.unary? then return { unary: expr.unary, right: dig(expr.right) }
  if expr.call? then return { call: dig(expr.call), arg: dig(expr.arg) }
  if expr.binary? then return { binary: expr.binary, left: dig(expr.left), right: dig(expr.right) }
  if expr.condition? then return { condition: dig(expr.condition), ifThen: dig(expr.ifThen), ifElse: dig(expr.ifElse) }
  if expr.functionx?
    parameters = expr.parameters?.map (p) -> { name: p.name, type: p.type, value: (if p.value? then dig(p.value) else null) }
    return { functionx: dig(expr.functionx), parameters: parameters }
  if expr.local? then return { local: local, value: dig(expr) }
  if expr.code? then return { code: expr.code.map(dig) }
  expr


# turn all binary/unary expressions into calls.
flattenInfix = (expr) ->
  digExpr expr, ((x) -> x.binary? or x.unary?), (x) ->
    if x.binary?
      { call: { call: x.left, arg: { symbol: x.binary } }, arg: x.right }
    else if x.unary?
      op = switch x.unary
        when "+" then "positive"
        when "-" then "negative"
        else x.unary
      { call: { call: x.right, arg: { symbol: op } }, arg: { nothing: true } }

transformExpr = (expr) ->
  expr = flattenInfix(expr)
  expr


exports.flattenInfix = flattenInfix
exports.transformExpr = transformExpr
