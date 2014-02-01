util = require 'util'
dump = require '../dump'
descriptors = require './descriptors'
t_common = require './t_common'
t_scope = require './t_scope'
t_type = require './t_type'

copy = t_common.copy
error = t_common.error

# state passed through type-checker
class TransformState
  constructor: (@scope, @handlers = [], @typemap = descriptors.typemap, @options = {}) ->

  newScope: ->
    new TransformState(new t_scope.Scope(@scope), @handlers, @typemap, @options)

  newHandlers: ->
    new TransformState(@scope, [], @typemap, @options)

  toDebug: ->
    handlers = @handlers.map (h) ->
      key = if typeof h[0] == "string" then ".#{h[0]}" else h[0].toRepr()
      "#{key} -> #{h[1].toRepr()}"
    "{TransformState: scope=#{@scope.toDebug()}, @handlers=#{handlers}}"


# walk an expression tree, filling in type information.
# - add a new nested (lexical) 'scope' object to each expression node that
#   should open a new scope.
# - fill in types of newly-scoped variables as we find them.
# - add a type descriptor to 'new' expressions.
#
# returns [ type, expr ]
typecheckExpr = (tstate, expr) ->
  if tstate.options.logger? then tstate.options.logger "typecheck: #{dump.dumpExpr(expr)} -- #{tstate.toDebug()}"

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
    if not type? then error("Unknown reference '#{expr.reference}'", expr.state)
    return [ type, expr ]

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

  # { condition: expr, ifThen: expr, ifElse: expr }

  if expr.newObject?
    # sniff out the handler list, build a type descriptor for it, and attach it.
    tstate = tstate.newHandlers()
    [ _, newObject ] = typecheckExpr(tstate, expr.newObject)
    type = t_type.newType(tstate.handlers)
    return [ type, copy(expr, newObject: newObject, type: type) ]

  if expr.local?
    if tstate.scope.exists(expr.local.name) and not tstate.options.allowOverride
      error("Redefined local '#{expr.local.name}'", expr.local.state)
    [ type, vexpr ] = typecheckExpr(tstate, expr.value)
    tstate.scope.add(expr.local.name, type)
    return [ type, copy(expr, value: vexpr) ]

  if expr.on?
    if expr.on.compoundType?
      # open up a new (chained) scope, with references for the parameters
      tstate = tstate.newScope()
      for p in expr.on.compoundType
        tstate.scope.add(p.name, t_type.findType(p.type, tstate.typemap))
      guard = t_type.findType(expr.on, tstate.typemap)
      newScope = tstate.scope
    else
      guard = expr.on.symbol
    [ htype, hexpr ] = typecheckExpr(tstate, expr.handler)
    tstate.handlers.push [ guard, htype ]
    return [ descriptors.DNothing, copy(expr, handler: hexpr, scope: newScope) ]

  if expr.code?
    tstate = tstate.newScope()
    type = descriptors.DNothing
    code = expr.code.map (x) ->
      [ type, x ] = typecheckExpr(tstate, x)
      x
    return [ type, copy(expr, code: code, scope: tstate.scope) ]

  error("Not implemented yet: #{dump.dumpExpr(expr)}", expr.state)


exports.TransformState = TransformState
exports.typecheckExpr = typecheckExpr
