t_expr = require './transform/t_expr'
t_locals = require './transform/t_locals'
t_scope = require './transform/t_scope'

exports.packLocals = t_locals.packLocals
exports.Scope = t_scope.Scope
exports.transformExpr = t_expr.transformExpr
