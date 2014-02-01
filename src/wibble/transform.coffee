descriptors = require './transform/descriptors'
t_expr = require './transform/t_expr'
t_object = require './transform/t_object'
t_scope = require './transform/t_scope'
t_type = require './transform/t_type'
t_typecheck = require './transform/t_typecheck'

exports.DAny = descriptors.DAny
exports.DBoolean = descriptors.DBoolean
exports.DInt = descriptors.DInt
exports.DNothing = descriptors.DNothing
exports.DString = descriptors.DString
exports.DSymbol = descriptors.DSymbol
exports.findType = t_type.findType
exports.FunctionType = t_type.FunctionType
exports.Scope = t_scope.Scope
exports.TypeDescriptor = t_type.TypeDescriptor
exports.typemap = descriptors.typemap


exports.transformExpr = (expr) ->
  expr = t_expr.flattenInfix(expr)
  expr = t_object.checkHandlers(expr)
  expr = t_object.crushFunctions(expr)
  expr

exports.typecheck = (scope, expr, options = {}) ->
  tstate = new t_typecheck.TransformState(scope, null, null, options)
  [ type, expr ] = t_typecheck.typecheckExpr(tstate, expr)
  [ expr, type ]
