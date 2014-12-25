descriptors = require './transform/descriptors'
t_expr = require './transform/t_expr'
t_object = require './transform/t_object'
t_scope = require './transform/t_scope'
t_type = require './transform/t_type'
t_typecheck = require './transform/t_typecheck'
t_typestate = require './transform/t_typestate'

exports.DAny = descriptors.DAny
exports.DBoolean = descriptors.DBoolean
exports.DInt = descriptors.DInt
exports.DNothing = descriptors.DNothing
exports.DString = descriptors.DString
exports.DSymbol = descriptors.DSymbol
exports.findType = t_type.findType
exports.FunctionType = t_type.FunctionType
exports.NamedType = t_type.NamedType
exports.Scope = t_scope.Scope
exports.TypeDescriptor = t_type.TypeDescriptor
exports.typemap = descriptors.typemap


exports.transformExpr = (expr) ->
  expr = t_expr.flattenInfix(expr)
  expr = t_expr.normalizePostfix(expr)
  expr = t_expr.normalizeIf(expr)
  expr = t_expr.normalizeStruct(expr)
  expr = t_object.checkHandlers(expr)
  expr = t_object.crushFunctions(expr)
  expr

exports.typecheck = (scope, expr, options = {}) ->
  tstate = new t_typestate.TypeState(scope, options)
  expr = t_typecheck.buildScopes(expr, tstate)
  expr = t_typecheck.checkForwardReferences(expr, tstate)
  type = t_typecheck.sniffType(expr, tstate)
  [ expr, type ]
