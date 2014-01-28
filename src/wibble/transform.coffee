t_expr = require './transform/t_expr'
t_locals = require './transform/t_locals'
t_object = require './transform/t_object'
t_scope = require './transform/t_scope'
t_typecheck = require './transform/t_typecheck'

exports.Scope = t_scope.Scope

exports.transformExpr = (expr) ->
  expr = t_expr.flattenInfix(expr)
  expr = t_object.checkHandlers(expr)
  expr = t_object.crushFunctions(expr)
  expr

exports.typecheck = (scope, expr, options = {}) ->
  expr1 = t_locals.packLocals(scope, expr, options)
  type = t_typecheck.typeExpr(scope, expr1)
  [ expr, type ]
