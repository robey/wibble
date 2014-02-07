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
  constructor: (@scope, @options = {}) ->
    @handlers = []
    @typemap = descriptors.typemap
    @checkReferences = true
    @currentLocal = null

  copy: ->
    rv = new TransformState(@scope, @options)
    rv.handlers = @handlers
    rv.typemap = @typemap
    rv.checkReferences = @checkReferences
    rv.currentLocal = @currentLocal
    rv

  newScope: ->
    @enterScope new t_scope.Scope(@scope)

  enterScope: (scope) ->
    rv = @copy()
    rv.scope = scope
    rv

  newHandlers: ->
    rv = @copy()
    rv.handlers = []
    rv

  stopCheckingReferences: ->
    rv = @copy()
    rv.checkReferences = false
    rv

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

  toRepr: ->
    "<Unknown #{@id}: #{@name}>"


# transform the expression tree, checking locals and references.
# - attach a new "scope" object to each place we enter a new scope.
# - mark locals with an unresolved type.
# - complain about references that don't appear to resolve to anything (and
#   can't be forward references)
buildScopes = (expr, tstate) ->
  t_expr.digExpr expr, tstate, (expr, tstate) ->
    if expr.reference? and tstate.checkReferences
      type = tstate.scope.get(expr.reference)
      if not type? then error("Unknown reference #{tstate.scope.toDebug()} '#{expr.reference}'", expr.state)
    if expr.local?
      if tstate.scope.exists(expr.local.name) and not tstate.options.allowOverride
        error("Redefined local '#{expr.local.name}'", expr.local.state)
      tstate.scope.add(expr.local.name, new UnknownType(expr.local.name))
    if expr.on?
      # code inside a handler is allowed to make forward references, so stop
      # checking for now. (we'll do another pass for these.)
      tstate = tstate.stopCheckingReferences()
      if expr.on.compoundType?
        # open up a new (chained) scope, with references for the parameters
        tstate = tstate.newScope()
        for p in expr.on.compoundType
          tstate.scope.add(p.name, t_type.findType(p.type, tstate.typemap))
        return [ copy(expr, scope: tstate.scope), tstate ]
    if expr.code?
      tstate = tstate.newScope()
      return [ copy(expr, scope: tstate.scope), tstate ]
    [ expr, tstate ]

# helper for walking the expression tree without transforming it
walk = (expr, tstate, f) ->
  t_expr.digExpr expr, tstate, (expr, tstate) ->
    if expr.scope? then tstate = tstate.enterScope(expr.scope)
    f(expr, tstate)
    [ expr, tstate ]

# pass 2:
# - check forward references for code inside handlers
# - for each local, memoize the expression and the dependent refs into a
#   'variables' table
checkForwardReferences = (expr, tstate) ->
  variables = {}
  walk expr, tstate, (expr, tstate) ->
    if expr.reference?
      if not tstate.scope.get(expr.reference)?
        error("Unknown reference #{tstate.scope.toDebug()} '#{expr.reference}'", expr.state)
    if expr.local?
      type = tstate.scope.get(expr.local.name)
      if type instanceof UnknownType
        variables[type.id] = { expr: expr, type: type, tstate: tstate }

  # build up the list of inner unresolved references per variable
  for k, v of variables
    v.radicals = {}
    walk v.expr.value, tstate, (expr, tstate) ->
      if expr.reference?
        type = tstate.scope.get(expr.reference)
        if type instanceof UnknownType then v.radicals[type.id] = true

  # sort by count of free radicals, so we tackle the easy ones first.
  worklist = []
  for k, v of variables then worklist.push v
  worklist.sort (a, b) -> Object.keys(a.radicals).length - Object.keys(b.radicals).length

  for w in worklist
    if w.tstate.options.logger? then w.tstate.options.logger "typecheck: resolve variable #{w.expr.local.name}"
    [ type, _ ] = typecheckExpr(w.tstate, w.expr.value, w.type, variables)
    w.tstate.scope.add(w.expr.local.name, type)

  expr







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
    # sniff out the handler list, build a type descriptor for it, and attach it.
    tstate = tstate.newHandlers()
    [ _, newObject ] = typecheckExpr(tstate, expr.newObject)
    type = t_type.newType(tstate.handlers)
    return [ type, copy(expr, newObject: newObject, type: type) ]

  if expr.local?
    type = tstate.scope.get(expr.local.name)
    return [ type, expr ]

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
exports.TransformState = TransformState
exports.typecheckExpr = typecheckExpr
