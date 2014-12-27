util = require 'util'
dump = require '../dump'
r_namespace = require './r_namespace'

# an Object has a type, and state.
class WObject
  constructor: (@type, closure = null) ->
    # local state
    @state = new r_namespace.Namespace(closure)
    # native state, if this is a native object
    @native = {}

  inspect: ->
    if @type[":inspect"]? then return @type[":inspect"](@)
    # hack to make a pretty display for simple functions
    if @type.originalAst? then return dump.dumpExpr(@type.originalAst)
    fields = @state.keys().map (k) -> "#{k} = #{@state.get(k).inspect()}"
    "#{@type.inspect()}(#{fields.join ', '})"

  equals: (other) ->
    if @type[":equals"]? then return @type[":equals"](@, other)
    @type.equals(other.type) and @state.equals(other.state) and @native == other.native


exports.WObject = WObject
