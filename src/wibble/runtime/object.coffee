util = require 'util'
dump = require '../dump'
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
    # hack to make a pretty display for simple functions
    if @type.originalAst? then return dump.dumpExpr(@type.originalAst)
    # FIXME let objects override ":repr" or something
    fields = @scope.keys().map (k) -> "#{k} = #{@scope.get(k).toRepr()}"
    "#{@type.toRepr()}(#{fields.join ', '})"

  equals: (other) ->
    if @type[":equals"]? then return @type[":equals"](@, other)
    @type.equals(other.type) and @scope.equals(other.scope) and @native == other.native


exports.WObject = WObject
