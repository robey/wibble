util = require 'util'
t_common = require './t_common'
t_expr = require './t_expr'
t_scope = require './t_scope'
t_type = require './t_type'
t_typecheck = require './t_typecheck'

error = t_common.error

# this must run after functions are crushed into handlers.
# phase 1: add a 'scope' field to every expression that should open a new scope.
buildScope = (scope, expr, options = {}) ->
  t_expr.digExpr expr, scope, (expr, scope, copy) ->
    if expr.code?
      # open up a new (chained) scope
      scope = new t_scope.Scope(scope)
      return [ copy(scope: scope), scope ]
    if expr.on? and expr.on.compoundType?
      # open up a new (chained) scope, with references for the parameters
      scope = new t_scope.Scope(scope)
      for p in expr.on.compoundType
        scope.add(p.name, t_type.buildType(p.type), p.value or { nothing: true })
      return [ copy(scope: scope), scope ]
    [ expr, scope ]

# phase 2: fill in scopes with expressions.
# this must happen after all scopes are added, so the inner scopes get copied over.
checkReferences = (scope, expr, options = {}) ->
  t_expr.digExpr expr, scope, (expr, scope, copy) ->
    if expr.scope? then scope = expr.scope
    if expr.on? and expr.on.compoundType?
      for p in expr.on.compoundType
        scope.add(p.name, t_type.buildType(p.type), p.value or { nothing: true })
    if expr.local?
      if scope.exists(expr.local.name) and not options.allowOverride
        error("Redefined local '#{expr.local.name}'", expr.local.state)
      # fill in type on a later cycle
      scope.add(expr.local.name, null, expr.value)
    if expr.reference?
      if not scope.get(expr.reference)?
        # try to find a similar local
        error("Unknown reference '#{expr.reference}'", expr.state)
    [ expr, scope ]

packLocals = (scope, expr, options = {}) ->
  expr = buildScope(scope, expr, options)
  expr = checkReferences(scope, expr, options)


exports.packLocals = packLocals
