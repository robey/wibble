util = require 'util'
misc = require '../misc'

# a map of (string -> WObject), possibly chained to a parent namespace.
class Namespace
  constructor: (@parent) ->
    @symtab = {}
    @typemap = @parent?.typemap
  
  get: (name) ->
    if @symtab[name]? then return @symtab[name]
    if @parent? then return @parent.get(name)
    null

  update: (name, value) ->
    if @symtab[name]?
      @symtab[name] = value
      return true
    @parent? and @parent.update(name, value)

  set: (name, value) ->
    @symtab[name] = value

  push: -> new Namespace(@)

  keys: ->
    Object.keys(@symtab).sort()

  equals: (other) ->
    keys = @keys()
    if keys != other.keys() then return false
    for k in keys then if @get(k) != other.get(k) then return false
    true
    
  toDebug: ->
    "{" + @keys().join(", ") + "}" + (if @parent? then " \u21d7 " + @parent.toDebug() else "")


exports.Namespace = Namespace
