util = require 'util'
t_common = require './t_common'
t_expr = require './t_expr'
t_scope = require './t_scope'

error = t_common.error

# (this must run after functions are crushed into handlers.)
packLocals = (scope, expr, options = {}) ->
  t_expr.digExpr expr, scope, (expr, scope, copy) ->
    if expr.code?
      # open up a new (chained) scope
      scope = new t_scope.Scope(scope)
      return [ copy(scope: scope), scope ]
    if expr.on? and expr.on.parameters?
      # open up a new (chained) scope, with references for the parameters
      scope = new t_scope.Scope(scope)
      for p in expr.on.parameters
        scope.add(p.name, p.value or { nothing: true })
      return [ copy(scope: scope), scope ]
    if expr.local?
      if scope.exists(expr.local.name) and not options.allowOverride
        error("Redefined local '#{expr.local.name}'", expr.local.state)
      scope.add(expr.local.name, expr.value)
      [ expr, scope ]
    if expr.reference?
      if not scope.get(expr.reference)?
        # try to find a similar local
        error("Unknown reference '#{expr.reference}'", expr.state)
    [ expr, scope ]


exports.packLocals = packLocals
