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
  if expr.map? then return { map: expr.map.map (elem) -> elem.map(dig) }

  if expr.unary? then return { unary: expr.unary, right: dig(expr.right) }
  if expr.call? then return { call: dig(expr.call), arg: dig(expr.arg) }
  if expr.binary? then return { binary: expr.binary, left: dig(expr.left), right: dig(expr.right) }
  if expr.condition? then return { condition: dig(expr.condition), ifThen: dig(expr.ifThen), ifElse: dig(expr.ifElse) }
  expr

    # { array: [ expr* ] }
    # { map: [ [ expr, expr ]* ] }
    # { struct: [ { name?, expression: expr }* ] }
    # { unary: "-"/"not", right: expr }
    # { call: expr, arg: expr }
    # { binary: (op), left: expr, right: expr }
    # { condition: expr, ifThen: expr, ifElse: expr }

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


# t_expr.coffee

# dig = (expr, match, transform) ->
#   if match(expr) then expr = transform(expr)
#   # annoying special-case recursions
#   if expr.struct?
#     fields = for field in expr.struct
#       { name: field.name, expression: dig(field.expression, match, transform) }
#     { struct: fields }

#   else if expr.code?
#     { code: expr.code.map((x) -> dig(x, match, transform)) }
#   else if expr.local?
#     { local: expr.local, value: dig(expr.value, match, transform) }
#   else if expr.func?
#     params = for p in expr.params
#       v = if p.value? then dig(p.value, match, transform) else undefined
#       { name: p.name, type: p.type, value: v }
#     { params: params, func: dig(expr.func, match, transform) }
#   else if expr.on?
#     { on: dig(expr.on, match, transform), handler: dig(expr.handler, match, transform) }
#   else if expr.method?
#     params = for p in expr.params
#       v = if p.value? then dig(p.value, match, transform) else undefined
#       { name: p.name, type: p.type, value: v }
#     { method: expr.method, params: params, body: dig(expr.body, match, transform) }
#   else if expr.proto?
#     params = for p in expr.params
#       v = if p.value? then dig(p.value, match, transform) else undefined
#       { name: p.name, type: p.type, value: v }
#     { proto: expr.proto, params: params, body: dig(expr.body, match, transform) }
#   else
#     expr
