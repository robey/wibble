util = require 'util'
builtins = require './builtins'
d_expr = require '../dump/d_expr'
d_type = require '../dump/d_type'
t_common = require './t_common'
t_type = require './t_type'

error = t_common.error

# FIXME should be elsewhere, probably
copy = (expr, changes) ->
  rv = {}
  for k, v of expr when changes[k] != null then rv[k] = v
  for k, v of changes then rv[k] = v
  Object.freeze(rv)

# determine the type of an expression by traversing the expression tree and
# composing it.
# this must happen after packLocals, so we know all references will resolve.
# it can now fill in the type of each local as it goes.
# returns [ type, expr ] in case it needs to modify the inner expression to
# fill in a type descriptor on a 'new' expression.
typeExpr = (scope, expr, typeMap = builtins.descriptors) ->
  if expr.nothing? then return [ builtins.DNothing, expr ]
  if expr.boolean? then return [ builtins.DBoolean, expr ]
  if expr.number?
    # { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    if expr.number in [ "base2", "base10", "base16" ] then return [ builtins.DInt, expr ]
    error("Not implemented yet", expr.state)
  if expr.symbol? then return [ builtins.DSymbol, expr ]
  if expr.string? then return [ builtins.DString, expr ]

  if expr.reference?
    local = scope.get(expr.reference)
    if not local.type?
      [ type, texpr ] = typeExpr(scope, local.expr, typeMap)
      local.type = type
      local.expr = texpr
    return [ local.type, expr ]
  # { array: [ expr* ] }
  # { struct: [ { name?, expression: expr }* ] }
  if expr.call?
    [ ltype, call ] = typeExpr(scope, expr.call)
    [ rtype, arg ] = typeExpr(scope, expr.arg)
    return [ ltype.handlerTypeForMessage(rtype, expr.arg), copy(expr, call: call, arg: arg) ]
  # { condition: expr, ifThen: expr, ifElse: expr }
  if expr.newObject?
    handlers = []
    code = expr.newObject.code.map (x) ->
      if x.on?
        innerScope = if x.on.symbol? then expr.scope else x.scope
        [ type, thandler ] = typeExpr(innerScope, x.handler, typeMap)
        handlers.push [
          if x.on.symbol? then x.on.symbol else t_type.buildType(x.on)
          type
        ]
        copy(x, handler: thandler)
      else
        x
    newObject = copy(expr.newObject, code: code)
    [ _, newObject ] = typeExpr(expr.scope, newObject, typeMap)
    type = t_type.newType(handlers)
    return [ type, copy(expr, newObject: newObject, type: type) ]
  if expr.local?
    # same as reference, really.
    local = scope.get(expr.local.name)
    if not local.type?
      [ type, texpr ] = typeExpr(scope, local.expr, typeMap)
      local.type = type
      local.expr = texpr
    return [ local.type, expr ]
  if expr.on? then return [ builtins.DNothing, expr ]
  if expr.code?
    rv = builtins.DNothing
    code = expr.code.map (x) ->
      [ rv, x ] = typeExpr(expr.scope, x, typeMap)
      x
    return [ rv, copy(expr, code: code) ]
  error("Not implemented yet: #{d_expr.dumpExpr(expr)}", expr.state)


exports.typeExpr = typeExpr
