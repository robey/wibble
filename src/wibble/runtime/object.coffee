util = require 'util'
r_scope = require './r_scope'

# an Object has a type, and state.
class WObject
  constructor: (@type, closure = null) ->
    # local state
    @scope = new r_scope.Scope(closure)
    # native state, if this is a native object
    @native = {}

  toRepr: (locals, logger) ->
    if @type[":repr"]? then return @type[":repr"](@)
    # symbol = require './symbol'
    # handler = @type.handlerForMessage(symbol.TSymbol.create(":repr"))
    # if handler?
    #   r_expr = require './r_expr'
    #   rv = r_expr.evalCall(@, ":repr", locals, logger)
    #   if not (typeof rv == "string") then rv = rv.toRepr()
    #   rv
    fields = @scope.keys().map (k) -> "#{k} = #{@scope.get(k).toRepr()}"
    "#{@type.toRepr()}(#{fields.join ', '})"

  equals: (other) ->
    if @type[":equals"]? then return @type[":equals"](@, other)
    @type.equals(other.type) and @scope.equals(other.scope) and @native == other.native


exports.WObject = WObject
