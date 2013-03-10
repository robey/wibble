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
  constructor: (@scope, @expr) ->

  toDebug: ->
    "scope=#{@scope.toDebug()} expr=#{dumpExpr(@expr)}"

# a value can receive messages, and have registered handlers.
# all values also have a type.
class WValue
  constructor: (@type) ->
    # symtab is for symbols (strings)
    @symtab = {}
    # handlers is a list of (type, handler)
    @handlers = []

  toDebug: -> "<value>"

  toDebugType: -> [ @type.toDebug(), @toDebug() ]

  on: (message, handler) ->
    if handler instanceof Function
      # builtin handlers don't need scope
      handler = new Handler(new Scope(), handler)
    if typeof message == "string"
      @symtab[message] = handler
    else
      @handlers.push([ message, handler ])

  get: (message) ->
    types = require "./types.coffee"
    if message.type == types.SymbolType
      handler = @symtab[message.name]
      if (not handler?) and @type? then handler = @type.get(message)
      if handler? then return handler
    null

  getHandlers: ->
    @handlers.concat(if @type? then @type.handlers else [])

  handlersDebug: ->
    symbols = (for symbol, handler of @symtab then ":#{symbol}")
    types = (for [ type, handler ] in @handlers then @type.toDebug)
    "<" + symbols.concat(types).join(", ") + ">"

exports.Scope = Scope
exports.Handler = Handler
exports.WValue = WValue
