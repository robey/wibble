
inspect = require("util").inspect

types = require("./types")
dumpExpr = require("./transform").dumpExpr

WAnyType = types.WAnyType
WSymbol = types.WSymbol

WUnitType = types.WUnitType
WSymbolType = types.WSymbolType
WIntType = types.WIntType
WFunctionType = types.WFunctionType


# map of (name: String -> type: WType) for things in scope.
class TypeScope
  constructor: (@parent=null) ->
    @map = {}

  get: (name) ->
    if @map[name]? then return @map[name]
    if @parent? then return @parent.get(name)
    null

  set: (name, type) ->
    # it's only an error if it's redefined in this scope.
    if @map[name]? then throw new Error("Attempt to redefine type of #{name}")
    @map[name] = type

  toDebug: ->
    "<" + (for k, v of @map then "#{k}=#{v.toDebug()}").join(", ") + ">" +
      (if @parent? then (" => " + @parent.toDebug()) else "")


class TypeChecker
  constructor: (@logger, @globals) ->

  # determine the returned type of an expression.
  # compile any functions found in the process.
  check: (expr, typeScope) ->
    if not typeScope? then typeScope = new TypeScope()
    @logger("typecheck #{dumpExpr(expr)} in #{typeScope.toDebug()}")
    rv = @checkExpr(expr, typeScope)
    @logger("  \u21b3 #{rv.toDebug()}")
    rv

  checkExpr: (expr, typeScope) ->
    if expr.symbol?
      rv = typeScope.get(expr.symbol)
      if rv? then return rv
      return WSymbolType
    if expr.number?
      switch expr.number
        when "int" then return WIntType
        # FIXME
    # ...
    if expr.call?
      leftType = @checkExpr(expr.call, typeScope)
      rightType = @checkExpr(expr.arg, typeScope)
      handler = null
      # if the argument is a constant symbol, do a direct lookup
      if expr.arg.symbol? and not typeScope.get(expr.arg.symbol)?
        [ _, handler ] = leftType.handlerForMessage(new WSymbol(expr.arg.symbol))
      # if no luck, try using the type of the argument
      if not handler? then [ _, handler ] = leftType.handlerForType(rightType)
      # if that didn't work either, it'll have to be resolved at runtime.
      if not handler? then return WAnyType
      return handler.outType
    # ...
    if expr.code?
      rv = WUnitType
      newScope = new TypeScope(typeScope)
      for x in expr.code then rv = @checkExpr(x, newScope)
      return rv
    if expr.local?
      type = @checkExpr(expr.value, typeScope)
      typeScope.set(expr.local, type)
      return type
    if expr.func?
      [ inType, newScope ] = @compileParams(expr.params, typeScope)
      outType = @checkExpr(expr.func, newScope)
      return new WFunctionType(inType, outType)

    throw new Error("cannot typecheck expr #{dumpExpr(expr)}")

  # turn a params list into a type (WStructType or WUnitType)
  compileParams: (params, typeScope) ->
    newScope = new TypeScope(typeScope)
    if params.length == 0 then return [ WUnitType, newScope ] 
    fields = []
    for p in params
      type = @resolveType(p.type)
      fields.push(new types.WField(p.name, type, p.value))
      newScope.set(p.name, type)
    [ new types.WStructType(fields), newScope ]

  # turn a type name into a type object, or panic.
  # types can only be found in @globals (a scope).
  resolveType: (name) ->
    type = @globals.get(name)
    if not type? then throw new Error("Unknown type #{name}")
    if type.type != types.WTypeType then throw new Error("Not a type: #{name}")
    type


exports.TypeChecker = TypeChecker

