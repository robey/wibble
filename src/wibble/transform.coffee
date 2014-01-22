t_expr = require './transform/t_expr'
t_locals = require './transform/t_locals'
t_object = require './transform/t_object'
t_scope = require './transform/t_scope'

exports.packLocals = t_locals.packLocals
exports.Scope = t_scope.Scope

exports.transformExpr = (expr) ->
  expr = t_expr.flattenInfix(expr)
  expr = t_object.checkHandlers(expr)
  expr = t_object.crushFunctions(expr)
  expr
