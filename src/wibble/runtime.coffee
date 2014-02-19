r_expr = require './runtime/r_expr'
r_namespace = require './runtime/r_namespace'
types = require './runtime/types'

exports.evalExpr = r_expr.evalExpr
exports.Namespace = r_namespace.Namespace
exports.types = types
