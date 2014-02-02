r_expr = require './runtime/r_expr'
r_scope = require './runtime/r_scope'
types = require './runtime/types'

exports.evalExpr = r_expr.evalExpr
exports.Scope = r_scope.Scope
exports.types = types
