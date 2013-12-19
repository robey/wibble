util = require 'util'
misc = require '../misc'

# a scope is a map of (string -> WObject), possibly chained to a parent scope.
class Scope
  constructor: (@parent) ->
    @symtab = {}
  
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
    if not @update(name, value) then @symtab[name] = value

  setNew: (name, value) ->
    @symtab[name] = value

  keys: ->
    # Set, Tennessee-style.
    rv = {}
    for k, v of @symtab then rv[k] = true
    if @parent? then for k in @parent.keys() then rv[k] = true
    Object.keys(rv).sort()

  equals: (other) ->
    keys = @keys()
    if keys != other.keys() then return false
    for k in keys then if @get(k) != other.get(k) then return false
    true
    
  toDebug: (indent = 0) ->
    keys = Object.keys(@symtab).sort()
    lines = [
      "<Scope:"
      @parent?.toDebug(indent + 2) or ""
    ].concat(
      keys.map (k) -> "  #{k} = #{@symtab[k]?.toRepr() or '?'}"
    ).concat [
      ">"
    ]
    misc.spaces(indent) + lines.join("\n" + misc.spaces(indent)) + "\n"


exports.Scope = Scope
