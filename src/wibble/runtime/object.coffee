scope = require './scope'

# an Object:
# - has a type
# - can receive messages
# - can have registered handlers
class WObject
  constructor: (@type) ->
    # local state
    @state = new scope.Scope()
    # list of (value, handler)
    @valueHandlers = []
    # list of (type, handler)
    @typeHandlers = []

  toRepr: ->
    fields = @state.keys().map (k) -> "#{k} = #{@state.get(k).toRepr()}"
    "#{@type.toRepr()}(#{fields.join ', '})"

  equals: (other) ->
    @type.equals(other.type) and @state.equals(other.state)
    
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
