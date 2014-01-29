util = require 'util'
d_expr = require '../dump/d_expr'
t_common = require './t_common'

error = t_common.error

#
# type descriptors used during the transform/compile phase, for type checking.
#

# handlers: [ inType, outType ]*
# inType might be a string, meaning it's a symbol
class TypeDescriptor
  constructor: (@handlers = []) ->

  equals: (other) -> false
  canCoerceFrom: (other) -> @equals(other)
  toRepr: (precedence = true) -> @toDescriptor()
  toDescriptor: ->
    handlerNames = @handlers.map (h) ->
      (if typeof h[0] == "string" then ".#{h[0]}" else h[0].toRepr(true)) + " -> " + h[1].toRepr(false)
    if @handlers.length == 1 and (@handlers[0][0] instanceof TypeDescriptor)
      handlerNames[0]
    else
      "[" + handlerNames.join("; ") + "]"

  handlerTypeForMessage: (type, expr) ->
    if expr.symbol?
      for h in @handlers when typeof h[0] == "string"
        if expr.symbol == h[0] then return h[1]
    for h in @handlers when h[0] instanceof TypeDescriptor
      if h[0].canCoerceFrom(type) then return h[1]
    # FIXME warning: not type checked
    require('./builtins').DAny


class NamedType extends TypeDescriptor
  constructor: (@name, handlers = []) ->
    super(handlers)

  equals: (other) ->
    (other instanceof NamedType) and @name == other.name

  toRepr: (precedence = true) -> @name


# fields are { name, type, value: expr }
class CompoundType extends TypeDescriptor
  constructor: (@fields) ->
    # FIXME field accessors
    super([])

  equals: (other) ->
    if not (other instanceof CompoundType) then return false
    if other.fields.length != @fields.length then return false
    otherFields = {}
    for f in other.fields then otherFields[f.name] = f.type
    for f in @fields then if not (otherFields[f.name]? and f.type.equals(otherFields[f.name])) then return false
    true

  canCoerceFrom: (other) ->
    # a zero-element struct is the same as Nothing
    if @fields.length == 0 and other.equals(new NamedType("Nothing")) then return true
    # a one-element struct is the same as the type of that element (but do not recurse)
    if @fields.length == 1 and @fields[0].type.equals(other) then return true
    # check loose equality of compound types
    @equals(other)

  toRepr: (precedence = true) ->
    fields = @fields.map (f) -> f.name + ": " + f.type.toRepr(true) + (if f.value? then " = " + d_expr.dumpExpr(f.value) else "")
    "(" + fields.join(", ") + ")"


class FunctionType extends TypeDescriptor
  constructor: (@argType, @functionType) ->
    super([ [ @argType, @functionType ] ])

  equals: (other) ->
    if not (other instanceof FunctionType) then return false
    other.argType.equals(@argType) and other.functionType.equals(@functionType)

  toRepr: (precedence = true) ->
    rv = @argType.toRepr(true) + " -> " + @functionType.toRepr(false)
    if precedence then rv else "(#{rv})"


# FIXME template type


# convert an AST type into a type descriptor
buildType = (type) ->
  if type.typename? then return new NamedType(type.typename)
  if type.compoundType?
    fields = type.compoundType.map (f) -> { name: f.name, type: buildType(f.type), value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(buildType(type.argType), buildType(type.functionType))
  error "Not implemented yet: template type"

findType = (type, typemap) ->
  if type.typename?
    if not typemap[type.typename]? then error("Unknown type '#{type.typename}'", type.state)
    return typemap[type.typename]
  if type.compoundType?
    fields = type.compoundType.map (f) -> { name: f.name, type: findType(f.type, typemap), value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(findType(type.argType, typemap), findType(type.functionType, typemap))
  error "Not implemented yet: template type"

# new anonymous type
newType = (handlers) ->
  new TypeDescriptor(handlers)


exports.buildType = buildType
exports.findType = findType
exports.NamedType = NamedType
exports.newType = newType

# descriptorForType = (type, typeMap, state) ->
#   if type.typename?
#     d = descriptorMap[type.typename]
#     if d? then return d
#     error("Unknown type (no descriptor): #{type.typename}", state)
#   if type.functionType? then return [ [ type.argType, type.functionType ] ]
#   if type.compoundType?
#     # FIXME
#     error("Not implemented: compound type")
#   if type.templateType?
#     # FIXME
#     error("Not implemented: template type")



