util = require 'util'
misc = require '../misc'

# map of (string -> { type, expr }), possibly chained to a parent.
class Scope
  constructor: (@parent) ->
    @symtab = {}
  
  exists: (name) -> @symtab[name]?
  
  get: (name) ->
    if @symtab[name]? then return @symtab[name]
    if @parent? then return @parent.get(name)
    null

  add: (name, type, expr) ->
    @symtab[name] = { type, expr }


exports.Scope = Scope
