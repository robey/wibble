util = require 'util'
descriptors = require './descriptors'
t_scope = require './t_scope'
t_type = require './t_type'

# state passed through type-checker
class TypeState
  constructor: (@scope, @options = {}) ->
    @typemap = descriptors.typemap
    @checkReferences = true
    @type = null

  copy: ->
    rv = new TypeState(@scope, @options)
    rv.typemap = @typemap
    rv.checkReferences = @checkReferences
    rv.type = @type
    rv

  newScope: ->
    @enterScope new t_scope.Scope(@scope)

  enterScope: (scope) ->
    rv = @copy()
    rv.scope = scope
    rv

  newType: ->
    @enterType new t_type.newType([])

  enterType: (type) ->
    rv = @copy()
    rv.type = type
    rv

  newTypemap: ->
    @enterTypemap new t_scope.Scope(@typemap)

  enterTypemap: (typemap) ->
    rv = @copy()
    rv.typemap = typemap
    rv
    
  stopCheckingReferences: ->
    rv = @copy()
    rv.checkReferences = false
    rv

  toDebug: ->
    "<TypeState: scope=#{@scope.toDebug()}, type=#{@type?.toRepr()}, checkReferences=#{@checkReferences}>"


exports.TypeState = TypeState
