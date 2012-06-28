# basic transformations on the AST

inspect = require("util").inspect

# build a simple string representation of a parsed expression
dumpExpr = (expr) ->
  if expr.symbol? then return ":" + expr.symbol
  if expr.number? then return expr.value
  if expr.boolean? then return expr.boolean.toString()
  if expr.unit? then return "()"
  if expr.opref? then return ":" + expr.opref
  if expr.struct?
    fields = for field in expr.struct
      if field.name?
        field.name + " = " + dumpExpr(field.expression)
      else
        dumpExpr(field.expression)
    return "(" + fields.join(", ") + ")"
  if expr.call?
    return "(" + dumpExpr(expr.call) + " " + dumpExpr(expr.arg) + ")"
  if expr.unary?
    return expr.unary + "(" + dumpExpr(expr.right) + ")"
  if expr.binary?
    return "(" + dumpExpr(expr.left) + " " + expr.binary + " " + dumpExpr(expr.right) + ")"
  if expr.condition?
    return "(if " + dumpExpr(expr.condition) + " then " + dumpExpr(expr.ifThen) +
      (if (expr.ifElse) then (" else " + dumpExpr(expr.ifElse)) else "")
  if expr.code?
    return "{ " + (dumpExpr(e) for e in expr.code).join("; ") + " }"
  if expr.local?
    return "val " + expr.local + " = " + dumpExpr(expr.value)
  if expr.params?
    params = for p in expr.params
      p.name + ": " + p.type + (if p.value? then (" = " + dumpExpr(p.value)) else "")
    return "((" + params.join(", ") + ") -> " + dumpExpr(expr.body) + ")"
  "???"

# traverse an expression, looking for objects where 'match(obj)' returns
# true. for those, replace the object with whatever is returned by
# 'transform(obj)'. for the rest, leave them alone. for all objects, nested
# expressions are recursively dug.
dig = (expr, match, transform) ->
  if match(expr) then expr = transform(expr)
  # annoying special-case recursions
  if expr.struct?
    fields = for field in expr.struct
      { name: field.name, expression: dig(field.expression, match, transform) }
    { struct: fields }
  else if expr.call?
    { call: dig(expr.call, match, transform), arg: dig(expr.arg, match, transform) }
  else if expr.unary?
    right = dig(expr.right, match, transform)
    { unary: expr.unary, right: right }
  else if expr.binary?
    left = dig(expr.left, match, transform)
    right = dig(expr.right, match, transform)
    { binary: expr.binary, left: left, right: right }
  else if expr.condition?
    cond = dig(expr.condition, match, transform)
    ifThen = dig(expr.ifThen, match, transform)
    ifElse = if expr.ifElse? then dig(expr.ifElse, match, transform) else null
    { condition: cond, ifThen: ifThen, ifElse: ifElse }
  else if expr.code?
    { code: expr.code.map((x) -> dig(x, match, transform)) }
  else if expr.local?
    { local: expr.local, value: dig(expr.value, match, transform) }
  else if expr.params?
    params = for p in expr.params
      v = if p.value? then dig(p.value, match, transform) else null
      { name: p.name, type: p.type, value: v }
    { params: params, body: dig(expr.body, match, transform) }
  else
    expr

# turn all binary/unary expressions into calls.
flattenBinary = (expr) ->
  dig expr, ((x) -> x.binary? or x.unary?), (x) ->
    if x.binary?
      { call: { call: x.left, arg: { opref: x.binary } }, arg: x.right }
    else if x.unary?
      { call: { call: x.right, arg: { symbol: x.unary } }, arg: { unit: true } }


transform = (expr) ->
  expr = flattenBinary(expr)
  expr

exports.flattenBinary = flattenBinary
exports.transform = transform
exports.dumpExpr = dumpExpr

