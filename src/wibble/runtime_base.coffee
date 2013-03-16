util = require("util")
inspect = util.inspect

dumpExpr = require("./transform").dumpExpr


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

  toDebug: ->
    "<" + (for k, v of @symtab then "#{k}=#{if v? then v.toDebug() else '?'}").join(", ") + ">" +
      if @parent? then (" => " + @parent.toDebug()) else ""


class Handler
  constructor: (@scope, @outType, @expr) ->

  toDebug: ->
    "scope=#{@scope.toDebug()} expr=#{dumpExpr(@expr)}"


exports.Scope = Scope
exports.Handler = Handler
