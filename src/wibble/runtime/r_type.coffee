util = require 'util'
transform = require '../transform'
object = require './object'

# a runtime type, which points to a transform-time TypeDescriptor, but
# also contains actual handlers.
class Type
  constructor: (@descriptor) ->
    @valueHandlers = []
    @typeHandlers = []

  equals: (other) -> @descriptor.equals(other.descriptor)

  toRepr: -> @descriptor.toRepr()

  handlerForMessage: (message) ->
    if not @inited
      if @init? then @init()
      @inited = true
    for handler in @valueHandlers
      if message.equals(handler.guard) then return handler
    for handler in @typeHandlers
      if handler.guard.canCoerceFrom(message.type.descriptor) then return handler
    null

  on: (guard, expr) ->
    # shortcut for internal use:
    if typeof guard == "string"
      # avoid dependency loops:
      types = require './types'
      guard = types.TSymbol.create(guard)
    if guard instanceof transform.TypeDescriptor
      @typeHandlers.push { guard, expr }
    else
      @valueHandlers.push { guard, expr }

  # convert an object into this type.
  # this will only be called if @descriptor.canCoerceFrom() was true.
  # default implementation passes the object through unchanged, since the
  #   default #canCoerceFrom() will only be true for equal objects.
  coerce: (obj) ->
    obj

  # helper for native implementations
  nativeMethod: (name, nativeFunction) ->
    methodType = @descriptor.handlerTypeForMessage(transform.DSymbol, name)
    if not (methodType instanceof transform.FunctionType) then throw new Error("Native method must be function")
    # create a native function (arg -> expr)
    type = new Type(methodType)
    type.on methodType.argType, (target, message) -> nativeFunction(target.native.self, message)
    # on <symbol> -> <method>
    @on name, (target, message) ->
      f = new object.WObject(type)
      f.toRepr = -> "<native>"
      f.equals = (other) -> f is other
      f.native.self = target
      f


nativeType = (descriptor, fields) ->
  t = new Type(descriptor)
  for k, v of fields then t[k] = v
  t


exports.Type = Type
exports.nativeType = nativeType
