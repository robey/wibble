
inspect = require("util").inspect

types = require("./types")
dumpExpr = require("./transform").dumpExpr

WAnyType = types.WAnyType
WSymbol = types.WSymbol

WUnitType = types.WUnitType
WSymbolType = types.WSymbolType
WIntType = types.WIntType

# given a symtab of (local name -> type).
# determine the returned type of an expression.
typecheck = (logger, expr, symtab) ->
  logger("typecheck #{dumpExpr(expr)} in #{symtab}")
  rv = typecheck1(logger, expr, symtab)
  logger("typecheck -> #{rv.toDebug()}")
  rv

typecheck1 = (logger, expr, symtab) ->
  if expr.symbol?
    rv = symtab[expr.symbol]
    if rv? then return rv
    return WSymbolType
  if expr.number?
    switch expr.number
      when "int" then return WIntType
      # FIXME
  # ...
  if expr.call?
    leftType = typecheck(logger, expr.call, symtab)
    rightType = typecheck(logger, expr.arg, symtab)
    handler = null
    # if the argument is a constant symbol, do a direct lookup
    if expr.arg.symbol? and not symtab[expr.arg.symbol]?
      [ _, handler ] = leftType.handlerForMessage(new WSymbol(expr.arg.symbol))
    # if no luck, try using the type of the argument
    if not handler? then [ _, handler ] = leftType.handlerForType(rightType)
    # if that didn't work either, it'll have to be resolved at runtime.
    if not handler? then return WAnyType
    return handler.outType
  # ...
  if expr.code?
    rv = WUnitType
    newSymtab = {}
    for k, v of symtab then newSymtab[k] = v
    for line in expr.code then rv = typecheck(logger, line, newSymtab)
    return rv

  throw new Error("cannot typecheck expr #{dumpExpr(expr)}")

exports.typecheck = typecheck

