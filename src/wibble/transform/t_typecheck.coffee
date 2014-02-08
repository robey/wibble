util = require 'util'
dump = require '../dump'
descriptors = require './descriptors'
t_common = require './t_common'
t_expr = require './t_expr'
t_scope = require './t_scope'
t_type = require './t_type'
t_typestate = require './t_typestate'

copy = t_common.copy
error = t_common.error


_id = 0
class UnknownType
  constructor: (@name) ->
    _id += 1
    @id = _id

  isDefined: -> false

  toRepr: ->
    "<Unknown #{@id}: #{@name}>"


# transform the expression tree, checking locals and references.
# - attach a new "scope" object to each place we enter a new scope.
# - mark locals and handlers with an unresolved type.
# - complain about references that don't appear to resolve to anything (and
#   can't be forward references)
buildScopes = (expr, tstate) ->
  t_expr.digExpr expr, tstate, (expr, tstate) ->
    if expr.reference? and tstate.checkReferences
      type = tstate.scope.get(expr.reference)
      if not type? then error("Unknown reference #{tstate.scope.toDebug()} '#{expr.reference}'", expr.state)

    if expr.newObject?
      # attach a new (blank) type that we'll fill in with handlers
      tstate = tstate.newType()
      return [ copy(expr, newType: tstate.type), tstate ]

    if expr.local?
      if tstate.scope.exists(expr.local.name) and not tstate.options.allowOverride
        error("Redefined local '#{expr.local.name}'", expr.local.state)
      tstate.scope.add(expr.local.name, new UnknownType(expr.local.name))

    if expr.on?
      # code inside a handler is allowed to make forward references, so stop
      # checking for now. (we'll do another pass for these later.)
      tstate = tstate.stopCheckingReferences()
      type = new UnknownType("handler")
      if expr.on.compoundType?
        # open up a new (chained) scope, with references for the parameters
        tstate = tstate.newScope()
        for p in expr.on.compoundType
          tstate.scope.add(p.name, t_type.findType(p.type, tstate.typemap))
        tstate.type.addTypeHandler t_type.findType(expr.on, tstate.typemap), type
        return [ copy(expr, scope: tstate.scope, unresolved: type), tstate ]
      else
        tstate.type.addValueHandler expr.on.symbol, type
        return [ copy(expr, unresolved: type), tstate ]

    if expr.code?
      tstate = tstate.newScope()
      return [ copy(expr, scope: tstate.scope), tstate ]

    [ expr, tstate ]


# pass 2:
# - check forward references for code inside handlers
# - for each unresolved type, memoize the expression and the dependent refs
#   into a 'variables' table
checkForwardReferences = (expr, tstate) ->
  variables = {}
  walk expr, tstate, (expr, tstate) ->
    if expr.reference?
      if not tstate.scope.get(expr.reference)?
        error("Unknown reference #{tstate.scope.toDebug()} '#{expr.reference}'", expr.state)
    if expr.local?
      type = tstate.scope.get(expr.local.name)
      if not type.isDefined()
        variables[type.id] = { local: expr.local.name, expr: expr.value, type: type, tstate: tstate }
    if expr.on? and expr.unresolved?
      type = expr.unresolved
      variables[type.id] = { expr: expr.handler, type: type, tstate: tstate }

  # build up the list of inner unresolved references per variable
  for k, v of variables
    v.radicals = {}
    walk v.expr, v.tstate, (expr, tstate) ->
      if expr.reference?
        type = tstate.scope.get(expr.reference)
        if not type.isDefined() then v.radicals[type.id] = true

  unresolved = variables
  remainingVariables = tryProgress(unresolved, tstate)
  while Object.keys(remainingVariables).length < Object.keys(unresolved).length
    unresolved = remainingVariables
    remainingVariables = tryProgress(unresolved, tstate)
  if Object.keys(remainingVariables).length > 0
#    if w.tstate.options.logger? then w.tstate.options.logger "typecheck: resolve variable #{w.local} (#{w.type.toRepr()})"
    for id, v of remainingVariables
      error("FIXME: complex types", v.expr.state)

  # fill in types correctly now
  fillInTypes(expr, tstate, variables)

# optimistically assume that the unresolved types make a DAG, and resolve
# anything we can find that has zero radicals.
tryProgress = (variables, tstate) ->
  if tstate.options.logger?
    tstate.options.logger "Unresolved type variables: (#{Object.keys(variables).length})"
    for id, v of variables then tstate.options.logger "#{id}: #{util.inspect(Object.keys(v.radicals))} [#{v.type.toRepr()}] #{dump.dumpExpr(v.expr)} -- #{v.tstate.toDebug()}"
  remainingVariables = {}
  progress = []
  for id, v of variables
    if Object.keys(v.radicals).length == 0
      progress.push id
      v.type = sniffType(v.expr, v.tstate)
      if v.local
        v.tstate.scope.add(v.local, v.type)
      else
        v.tstate.type.fillInType(parseInt(id), v.type)
    else
      remainingVariables[id] = v
  if progress.length > 0
    # remove any radicals that we just resolved
    for id, v of remainingVariables
      for p in progress then delete v.radicals[p]
  remainingVariables

# walk an expression tree, sniffing out the type, depth-first.
sniffType = (expr, tstate) ->
  if expr.type? then return expr.type
  if expr.scope? then tstate = tstate.enterScope(expr.scope)

  # constants
  if expr.nothing? then return descriptors.DNothing
  if expr.boolean? then return descriptors.DBoolean
  if expr.number?
    # { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    if expr.number in [ "base2", "base10", "base16" ] then return descriptors.DInt
    error("Not implemented yet", expr.state)
  if expr.symbol? then return descriptors.DSymbol
  if expr.string? then return descriptors.DString

  if expr.reference? then return tstate.scope.get(expr.reference)

  # { array: [ expr* ] }

  if expr.struct?
    fields = expr.struct.map (f) -> { name: f.name, type: sniffType(f.value), value: f.value }
    return new t_type.CompoundType(fields)

  if expr.call?
    ltype = sniffType(expr.call, tstate)
    rtype = sniffType(expr.arg, tstate)
    if tstate.options.logger? then tstate.options.logger "typecheck call: #{ltype.toRepr()} << #{rtype.toRepr()}"
    type = ltype.handlerTypeForMessage(rtype, expr.arg)
    if tstate.options.logger? then tstate.options.logger "typecheck call:   \u21b3 #{type.toRepr()}"
    return type

  if expr.condition?
    ctype = sniffType(expr.condition, tstate)
    if not ctype.equals(descriptors.DBoolean) then error("Conditional expression must be true or false", expr.condition.state)
    ttype = sniffType(expr.ifThen, tstate)
    etype = sniffType(expr.ifElse, tstate)
    return branch([ ttype, etype ])

  if expr.newObject? then return expr.newType

  if expr.local? then return tstate.scope.get(expr.local.name)

  if expr.on? then return descriptors.DNothing

  if expr.code?
    type = descriptors.DNothing
    for x in expr.code
      type = sniffType(x, tstate)
    return type

  error("Not implemented yet: #{dump.dumpExpr(expr)}", expr.state)

fillInTypes = (expr, tstate, variables) ->
  if tstate.options.logger? then tstate.options.logger "fillInTypes: #{dump.dumpExpr(expr)}"
  if expr.type? and expr.type.isDefined() then return expr
  if expr.scope? then tstate = tstate.enterScope(expr.scope)
  if expr.newType? then tstate = tstate.enterType(expr.newType)

  if expr.reference? then return copy(expr, type: tstate.scope.get(expr.reference))
  if expr.call?
    call = fillInTypes(expr.call, tstate, variables)
    arg = fillInTypes(expr.arg, tstate, variables)
    expr = copy(expr, call: call, arg: arg)
    return copy(expr, type: sniffType(expr, tstate))
  if expr.condition?
    condition = fillInTypes(expr.condition, tstate, variables)
    ifThen = fillInTypes(expr.ifThen, tstate, variables)
    ifElse = fillInTypes(expr.ifElse, tstate, variables)
    expr = copy(expr, condition: condition, ifThen: ifThen, ifElse: ifElse)
    return copy(expr, type: sniffType(expr, tstate))
  if expr.newObject?
    return copy(expr, newObject: fillInTypes(expr.newObject, tstate, variables), type: expr.newType, newType: null)
  if expr.local?
    type = tstate.scope.get(expr.local.name)
    if not type.isDefined()
      tstate.scope.add(expr.local.name, variables[type.id].type)
    value = fillInTypes(expr.value, tstate, variables)
    return copy(expr, value: value)
  if expr.on? and expr.unresolved?
    handler = fillInTypes(expr.handler, tstate, variables)
    return copy(expr, unresolved: null, handler: handler, type: tstate.type)
  if expr.code?
    code = expr.code.map (x) -> fillInTypes(x, tstate, variables)
    expr = copy(expr, code: code)
    return copy(expr, type: sniffType(expr, tstate))

  return copy(expr, type: sniffType(expr, tstate))








selfTypeNotAllowed = (type, state) ->
  if (type instanceof UnknownType) then error("Fractal type definition makes my head hurt", state)

# walk an expression tree, filling in type information.
# - fill in types of newly-scoped variables as we find them.
# - add a type descriptor to 'new' expressions.
#
# returns [ type, expr ]
typecheckExpr = (tstate, expr, selftype = null, variables = {}) ->
  if expr.type? then return type
  if tstate.options.logger? then tstate.options.logger "typecheck: #{dump.dumpExpr(expr)} -- #{tstate.toDebug()}"
  [ type, expr ] = typecheckNode(tstate, expr)
  if tstate.options.logger? then tstate.options.logger "  <- #{type.toRepr()}"
  [ type, expr ]


typecheckNode = (tstate, expr, selftype, variables) ->

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
    type = tstate.scope.get(expr.reference)
    if (type not instanceof UnknownType) or type.id == selftype.id then return [ type, expr ]
    # do a substitution
    work = variables[type.id]
    type = typecheckExpr(work.tstate, work.expr.value, selftype, variables)
    if (type instanceof UnknownType) and type.id != selftype.id
      error("Can't resolve type; confused", expr.state)
    return [ type, expr ]

  # { array: [ expr* ] }

  if expr.struct?
    fields = []
    positional = true
    seen = {}
    for arg, i in expr.struct
      [ type, x ] = typecheckExpr(tstate, arg.value, selftype, variables)
      selfTypeNotAllowed(type, arg.state)
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
    [ ltype, call ] = typecheckExpr(tstate, expr.call, selftype, variables)
    [ rtype, arg ] = typecheckExpr(tstate, expr.arg, selftype, variables)
    selfTypeNotAllowed(ltype, call.state)
    selfTypeNotAllowed(rtype, arg.state)
    if tstate.options.logger? then tstate.options.logger "typecheck call: #{ltype.toRepr()} <- #{rtype.toRepr()}"
    type = ltype.handlerTypeForMessage(rtype, arg)
    if tstate.options.logger? then tstate.options.logger "typecheck call:   -> #{type.toRepr()}"
    return [ type, copy(expr, call: call, arg: arg) ]

  if expr.condition?
    [ ctype, condition ] = typecheckExpr(tstate, expr.condition)
    selfTypeNotAllowed(ctype, condition.state)
    if not ctype.equals(descriptors.DBoolean) then error("Conditional expression must be true or false", condition.state)
    [ ttype, ifThen ] = typecheckExpr(tstate, expr.ifThen)
    [ etype, ifElse ] = if expr.ifElse? then typecheckExpr(tstate, expr.ifElse) else [ descriptors.DNothing, { nothing: true } ]
    type = branch([ ttype, etype ])
    return [ type, copy(expr, condition: condition, ifThen: ifThen, ifElse: ifElse) ]

  if expr.newObject?
    [ _, newObject ] = typecheckExpr(tstate, expr.newObject)
    type = expr.newType
    return [ type, copy(expr, newObject: newObject, type: type, newType: null) ]

  if expr.local?
    type = tstate.scope.get(expr.local.name)
    return [ type, expr ]

  if expr.on?
    return [ descriptors.DNothing, expr ]

  if expr.code?
    type = descriptors.DNothing
    code = expr.code.map (x) ->
      [ type, x ] = typecheckExpr(tstate, x)
      x
    return [ type, copy(expr, code: code) ]

  error("Not implemented yet: #{dump.dumpExpr(expr)}", expr.state)






# helper for walking the expression tree without transforming it
walk = (expr, tstate, f) ->
  t_expr.digExpr expr, tstate, (expr, tstate) ->
    if expr.scope? then tstate = tstate.enterScope(expr.scope)
    if expr.newType? then tstate = tstate.enterType(expr.newType)
    f(expr, tstate)
    [ expr, tstate ]

branch = (types, selftype) ->
  options = []
  for t in types
    if t instanceof t_type.DisjointType
      options = options.concat(t.options)
    else if t != selftype  # x | self = x
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
exports.checkForwardReferences = checkForwardReferences
exports.sniffType = sniffType
exports.typecheckExpr = typecheckExpr
