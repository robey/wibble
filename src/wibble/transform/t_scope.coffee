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

  push: -> new Scope(@)
  
  toDebug: ->
    keys = Object.keys(@symtab).sort()
    "{#{keys.join(", ")}}" + (if @parent? then " \u21d7 #{@parent.toDebug()}" else "")


exports.Scope = Scope
