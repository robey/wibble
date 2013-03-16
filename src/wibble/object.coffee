base = require("./runtime_base.coffee")
Handler = base.Handler
Scope = base.Scope

# an Object can receive messages, and have registered handlers.
# all objects also have a type, and are immutable.
class WObject
  constructor: (@type) ->
    # local state
    @state = {}
    @reset()

  reset: ->
    # list of (value, handler)
    @valueHandlers = []
    # list of (type, handler)
    @typeHandlers = []

  # FIXME try harder.
  toDebug: -> "<object>"

  toDebugType: -> [ @type.toDebug(), @toDebug() ]

  equals: (other) -> other is @

  on: (message, handler) ->
    # shortcut for internal use:
    if typeof message == "string"
      message = new WSymbol(message)
    if message instanceof WType
      @typeHandlers.push [ message, handler ]
    else
      @valueHandlers.push [ message, handler ]

  # return [ type, handler ]
  handlerForMessage: (message) ->
    for [ value, handler ] in @valueHandlers
      if message.equals(value) then return [ message.type, handler ]
    @handlerForType(message.type)

  handlerForType: (type) ->
    for [ t, handler ] in @typeHandlers
      if t.coerce(type) then return [ t, handler ]
    [ null, null ]

  handlersDebug: ->
    vals = for [ v, h ] in @valueHandlers then v.toDebug()
    types = for [ t, h ] in @typeHandlers then t.toDebug()
    all = vals.concat(types).join(", ")
    "handlers(#{all})"

  # helper for native implementations
  nativeMethod: (name, inType, outType, func) ->
    ftype = new WFunctionType(inType, outType)
    # the symbol should return a function
    wfunc = (runtime, self, message) ->
      # and the function should call the natiwe function
      func1 = (runtime, self1, message1) ->
        func(runtime, self, message1)
      new WFunction(ftype, func1)
    handler = new Handler(ftype, wfunc)
    @on name, handler

exports.WObject = WObject

types = require("./types.coffee")
WType = types.WType
WSymbol = types.WSymbol
WFunction = types.WFunction
WFunctionType = types.WFunctionType

