util = require 'util'
r_scope = require './r_scope'

# wrapper for the handlers in an object:
#   - guard: value or type (depending on the kind of handler) to match against
#   - outType: return type of the expression
#   - expr: expression, or possibly a native function
# FIXME after type checking is implemented, the expression should probably contain its own outType.
class WHandler
  constructor: (@guard, @outType, @expr) ->


# an Object:
# - has a type
# - can receive messages
# - can have registered handlers
class WObject
  constructor: (@type, closure = null) ->
    # local state
    @scope = new r_scope.Scope(closure)
    @valueHandlers = []
    @typeHandlers = []

  toRepr: ->
    fields = @scope.keys().map (k) -> "#{k} = #{@scope.get(k).toRepr()}"
    "#{@type.toRepr()}(#{fields.join ', '})"

  equals: (other) ->
    @type.equals(other.type) and @scope.equals(other.scope)

  handlerForMessage: (message) ->
    for handler in @valueHandlers
      if message.equals(handler.guard) then return handler
    @handlerForType(message.type) or @type.handlerForMessage(message)

  handlerForType: (type) ->
    for handler in @typeHandlers
      if handler.guard.canCoerceFrom(type) then return handler
    null

  on: (guard, outType, expr) ->
    # avoid dependency loops:
    symbol = require './symbol'
    types = require './types'
    # shortcut for internal use:
    if typeof guard == "string" then guard = new symbol.WSymbol(guard)
    handler = new WHandler(guard, outType, expr)
    if guard instanceof types.WType
      @typeHandlers.push handler
    else
      @valueHandlers.push handler

  # helper for native implementations
  nativeMethod: (name, inType, outType, nativeFunction) ->
    types = require './types'
    # on <symbol> -> <method>
    methodType = new types.WFunctionType(inType, outType)
    method = (context, message) ->
      # now create a native function
      f = new WObject(methodType)
      # FIXME this is just a quick hack to approximate @
      f.on inType, outType, (x, message) -> nativeFunction(context, message)
      f.toRepr = -> "<native>"
      f.equals = (other) -> f is other
      f
    @on name, methodType, method


exports.WObject = WObject
