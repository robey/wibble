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


exports.WObject = WObject
