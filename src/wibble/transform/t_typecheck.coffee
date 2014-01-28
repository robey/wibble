util = require 'util'
builtins = require './builtins'
d_expr = require '../dump/d_expr'
d_type = require '../dump/d_type'
t_common = require './t_common'
t_type = require './t_type'

error = t_common.error

# determine the type of an expression by traversing the expression tree and
# composing it.
# this must happen after packLocals, so we know all references will resolve.
# it can now fill in the type of each local as it goes.
typeExpr = (scope, expr, typeMap = builtins.descriptors) ->
  if expr.nothing? then return builtins.DNothing
  if expr.boolean? then return builtins.DBoolean
  if expr.number?
    # { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    if expr.number in [ "base2", "base10", "base16" ] then return builtins.DInt
    error("Not implemented yet", expr.state)
  if expr.symbol? then return builtins.DSymbol
  if expr.string? then return builtins.DString

  if expr.reference?
    local = scope.get(expr.reference)
    if not local.type? then local.type = typeExpr(scope, local.expr, typeMap)
    return local.type
  # { array: [ expr* ] }
  # { struct: [ { name?, expression: expr }* ] }
  if expr.call?
    ltype = typeExpr(scope, expr.call)
    rtype = typeExpr(scope, expr.arg)
    return ltype.handlerTypeForMessage(rtype, expr.arg)
  # { condition: expr, ifThen: expr, ifElse: expr }
  if expr.newObject?
    handlers = []
    for x in expr.newObject.code when x.on?
      innerScope = if x.on.symbol? then expr.scope else x.scope
      handlers.push [
        if x.on.symbol? then x.on.symbol else t_type.buildType(x.on)
        typeExpr(innerScope, x.handler, typeMap)
      ]
    typeExpr(expr.scope, expr.newObject, typeMap)
    expr.type = t_type.newType(handlers)
    return expr.type
  if expr.local?
    # same as reference, really.
    local = scope.get(expr.local.name)
    if not local.type? then local.type = typeExpr(scope, local.expr, typeMap)
    return local.type
  if expr.on? then return builtins.DNothing
  if expr.code?
    rv = builtins.DNothing
    for x in expr.code then rv = typeExpr(expr.scope, x, typeMap)
    return rv
  error("Not implemented yet: #{d_expr.dumpExpr(expr)}", expr.state)


exports.typeExpr = typeExpr
