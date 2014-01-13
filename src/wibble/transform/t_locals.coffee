util = require 'util'
t_error = require './t_error'
t_expr = require './t_expr'
t_scope = require './t_scope'

packLocals = (scope, expr) ->
  t_expr.digExpr expr, scope, (expr, scope, copy) ->
    if expr.code?
      # open up a new (chained) scope
      scope = new t_scope.Scope(scope)
      return [ copy(scope: scope), scope ]
    if expr.local?
      if scope.exists(expr.local.name) then t_error.error("Redefined local '#{expr.local.name}'", expr.local.state)
      scope.add(expr.local.name, expr.value)
      expr
    if expr.reference?
      if not scope.get(expr.reference)?
        # try to find a similar local
        t_error.error("Unknown reference '#{expr.reference}'", expr.state)
    expr


exports.packLocals = packLocals
