util = require 'util'
misc = require '../misc'

# map of (string -> type), possibly chained to a parent.
class Scope
  constructor: (@parent) ->
    @symtab = {}
  
  exists: (name) -> @symtab[name]?
  
  get: (name) ->
    if @symtab[name]? then return @symtab[name]
    if @parent? then return @parent.get(name)
    null

  add: (name, type) ->
    @symtab[name] = type

  toDebug: ->
    keys = Object.keys(@symtab).sort()
    "{scope: #{keys.join(", ")}" + (if @parent? then " -> #{@parent.toDebug()}" else "") + "}"


exports.Scope = Scope
