util = require 'util'
dump = require '../dump'
descriptors = require './descriptors'
t_common = require './t_common'
t_expr = require './t_expr'
t_scope = require './t_scope'
t_type = require './t_type'

copy = t_common.copy
error = t_common.error

# state passed through type-checker
class TransformState
  constructor: (@scope, @handlers = [], @typemap = descriptors.typemap, @unresolved = {}, @options = {}) ->

  newScope: ->
    new TransformState(new t_scope.Scope(@scope), @handlers, @typemap, @unresolved, @options)

  enterScope: (scope) ->
    new TransformState(scope, @handlers, @typemap, @unresolved, @options)

  newHandlers: ->
    new TransformState(@scope, [], @typemap, @unresolved, @options)

  toDebug: ->
    handlers = @handlers.map (h) ->
      key = if typeof h[0] == "string" then ".#{h[0]}" else h[0].toRepr()
      "#{key} -> #{h[1].toRepr()}"
    "{TransformState: scope=#{@scope.toDebug()}, @handlers=#{handlers}}"


_id = 0
class UnknownType
  constructor: (@name) ->
    _id += 1
    @id = _id


# first, walk the entire expression tree. set the type of each new variable
# to a new "unknown type", and add this type to a set of unknowns.
buildScopes = (expr, tstate) ->
  expr = t_expr.digExpr expr, tstate, (expr, tstate) ->
    if expr.reference?
      type = tstate.scope.get(expr.reference)
      if not type? then error("Unknown reference #{tstate.scope.toDebug()} '#{expr.reference}'", expr.state)
    if expr.local?
      if tstate.scope.exists(expr.local.name) and not tstate.options.allowOverride
        error("Redefined local '#{expr.local.name}'", expr.local.state)
      type = new UnknownType(expr.local.name)
      tstate.scope.add(expr.local.name, type)
      tstate.unresolved[type.id] = type
    if expr.on? and expr.on.compoundType?
      # open up a new (chained) scope, with references for the parameters
      tstate = tstate.newScope()
      for p in expr.on.compoundType
        tstate.scope.add(p.name, t_type.findType(p.type, tstate.typemap))
      return [ copy(expr, scope: tstate.scope), tstate ]
    if expr.code?
      tstate = tstate.newScope()
      return [ copy(expr, scope: tstate.scope), tstate ]
    [ expr, tstate ]
  [ expr, tstate ]

unresolved = (type) ->
  e = new Error("Unresolved types inside: #{type.toRepr()}")
  e.type = type
  throw e


# walk an expression tree, filling in type information.
# - add a new nested (lexical) 'scope' object to each expression node that
#   should open a new scope.
# - fill in types of newly-scoped variables as we find them.
# - add a type descriptor to 'new' expressions.
#
# returns [ type, expr ]
typecheckExpr = (tstate, expr) ->
  if tstate.options.logger? then tstate.options.logger "typecheck: #{dump.dumpExpr(expr)} -- #{tstate.toDebug()}"
  [ type, expr ] = typecheckNode(tstate, expr)
  if type instanceof UnknownType then unresolved(type)
  [ type, expr ]


typecheckNode = (tstate, expr) ->
  # constants
  if expr.nothing? then return [ descriptors.DNothing, expr ]
  if expr.boolean? then return [ descriptors.DBoolean, expr ]
  if expr.number?
    # { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    if expr.number in [ "base2", "base10", "base16" ] then return [ descriptors.DInt, expr ]
    error("Not implemented yet", expr.state)
  if expr.symbol? then return [ descriptors.DSymbol, expr ]
  if expr.string? then return [ descriptors.DString, expr ]

  if expr.reference?
    # already checked that the reference exists.
    return [ tstate.scope.get(expr.reference), expr ]

  # { array: [ expr* ] }

  if expr.struct?
    fields = []
    positional = true
    seen = {}
    for arg, i in expr.struct
      [ type, x ] = typecheckExpr(tstate, arg.value)
      if not arg.name
        if not positional then error("Positional fields can't come after named fields", arg.state)
        fields.push { name: "?#{i}", type: type, value: x }
      else
        positional = false
        if seen[arg.name] then error("Field name #{arg.name} is repeated", arg.state)
        seen[arg.name] = true
        fields.push { name: arg.name, type: type, value: x }
    type = new t_type.CompoundType(fields)
    return [ type, { struct: fields, type: type } ]

  if expr.call?
    [ ltype, call ] = typecheckExpr(tstate, expr.call)
    [ rtype, arg ] = typecheckExpr(tstate, expr.arg)
    if tstate.options.logger? then tstate.options.logger "typecheck call: #{ltype.toRepr()} :: #{rtype.toRepr()}"
    type = ltype.handlerTypeForMessage(rtype, arg)
    if tstate.options.logger? then tstate.options.logger "typecheck call:   -> #{type.toRepr()}"
    return [ type, copy(expr, call: call, arg: arg) ]

  if expr.condition?
    [ ctype, condition ] = typecheckExpr(tstate, expr.condition)
    if not ctype.equals(descriptors.DBoolean) then error("Conditional expression must be true or false", condition.state)
    [ ttype, ifThen ] = typecheckExpr(tstate, expr.ifThen)
    [ etype, ifElse ] = if expr.ifElse? then typecheckExpr(tstate, expr.ifElse) else [ descriptors.DNothing, { nothing: true } ]
    type = branch([ ttype, etype ])
    return [ type, copy(expr, condition: condition, ifThen: ifThen, ifElse: ifElse) ]

  if expr.newObject?
    # sniff out the handler list, build a type descriptor for it, and attach it.
    tstate = tstate.newHandlers()
    [ _, newObject ] = typecheckExpr(tstate, expr.newObject)
    type = t_type.newType(tstate.handlers)
    return [ type, copy(expr, newObject: newObject, type: type) ]

  if expr.local?
    [ type, vexpr ] = typecheckExpr(tstate, expr.value)
    tstate.scope.add(expr.local.name, type)
    return [ type, copy(expr, value: vexpr) ]

  if expr.on?
    if expr.on.compoundType?
      tstate = tstate.enterScope(expr.scope)
      guard = t_type.findType(expr.on, tstate.typemap)
    else
      guard = expr.on.symbol
    [ htype, hexpr ] = typecheckExpr(tstate, expr.handler)
    tstate.handlers.push [ guard, htype ]
    return [ descriptors.DNothing, copy(expr, handler: hexpr) ]

  if expr.code?
    tstate = tstate.enterScope(expr.scope)
    type = descriptors.DNothing
    code = expr.code.map (x) ->
      [ type, x ] = typecheckExpr(tstate, x)
      x
    return [ type, copy(expr, code: code) ]

  error("Not implemented yet: #{dump.dumpExpr(expr)}", expr.state)


branch = (types) ->
  options = []
  for t in types
    if t instanceof t_type.DisjointType
      options = options.concat(t.options)
    else
      options.push t
  new t_type.DisjointType(mergeTypes(options))

simplify = (type) ->
  if not (type instanceof t_type.DisjointType) then return type
  new t_type.DisjointType(mergeTypes(type.options))

# for a disjoint type, try to merge compatible types together
mergeTypes = (types) ->
  return types if types.length == 1
  for i in [0 ... types.length]
    for j in [i ... types.length]
      continue if i == j
      if types[i].canCoerceFrom(types[j])
        return mergeTypes [types[i]].concat(for n in [0 ... types.length] when n != i and n != j then types[n])
  types


exports.buildScopes = buildScopes
exports.TransformState = TransformState
exports.typecheckExpr = typecheckExpr
