util = require 'util'
misc = require '../misc'

# a scope is a map of (symbol -> value), possibly chained to a parent scope.
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

  toDebug: (indent = 0) ->
    keys = Object.keys(@symtab).sort()
    lines = [
      "<Scope:"
      @parent?.toDebug(indent + 2) or ""
    ].concat(
      keys.map (k) -> "  #{k} = #{@symtab[k]?.toDebug() or '?'}"
    ).concat [
      ">"
    ]
    misc.spaces(indent) + lines.join("\n" + misc.spaces(indent)) + "\n"


exports.Scope = Scope
