util = require 'util'
d_expr = require '../dump/d_expr'
parser = require '../parser'
t_common = require './t_common'

error = t_common.error

#
# type descriptors used during the transform/compile phase, for type checking.
#

# valueHandlers: { guard: string, type: TypeDescriptor }
# typeHandlers: { guard: TypeDescriptor, type: TypeDescriptor }
class TypeDescriptor
  constructor: (@valueHandlers = [], @typeHandlers = []) ->

  equals: (other) -> false

  canCoerceFrom: (other) -> @equals(other)

  toRepr: (precedence = true) -> @toDescriptor()

  toDescriptor: ->
    valueHandlers = @valueHandlers.map (h) -> ".#{h.guard} -> #{h.type.toRepr(false)}"
    typeHandlers = @typeHandlers.map (h) -> "#{h.guard.toRepr(true)} -> #{h.type.toRepr(false)}"
    # make a pretty shorthand for the simple function type
    if valueHandlers.length == 0 and typeHandlers.length == 1
      typeHandlers[0]
    else
      "[" + valueHandlers.concat(typeHandlers).join(", ") + "]"

  handlerTypeForMessage: (type, expr) ->
    # allow "expr" to be a string, too, for native methods.
    if expr.symbol? then expr = expr.symbol
    if typeof expr == "string"
      for h in @valueHandlers then if expr == h.guard then return h.type
    else
      for h in @typeHandlers then if h.guard.canCoerceFrom(type) then return h.type
    # FIXME warning: not type checked
    descriptors = require './descriptors'
    descriptors.DAny

  addValueHandler: (value, htype) -> @valueHandlers.push { guard: value, type: htype }

  addTypeHandler: (type, htype) -> @typeHandlers.push { guard: type, type: htype }


class NamedType extends TypeDescriptor
  constructor: (@name) ->
    super()

  equals: (other) ->
    (other instanceof NamedType) and @name == other.name

  toRepr: (precedence = true) -> @name


# fields are { name, type, value: expr }
class CompoundType extends TypeDescriptor
  constructor: (@fields) ->
    super()
    # field accessors
    for f in @fields then @addValueHandler f.name, f.type

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
    super()
    @addTypeHandler @argType, @functionType

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
    checkCompoundType(type)
    fields = type.compoundType.map (f) -> { name: f.name, type: buildType(f.type), value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(buildType(type.argType), buildType(type.functionType))
  error "Not implemented yet: template type"

findType = (type, typemap) ->
  if type.typename?
    if not typemap[type.typename]? then error("Unknown type '#{type.typename}'", type.state)
    return typemap[type.typename]
  if type.compoundType?
    checkCompoundType(type)
    fields = type.compoundType.map (f) -> { name: f.name, type: findType(f.type, typemap), value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(findType(type.argType, typemap), findType(type.functionType, typemap))
  error "Not implemented yet: template type"

# check for repeated fields before it's too late
checkCompoundType = (type) ->
  seen = {}
  for f in type.compoundType
    if seen[f.name] then error("Field name #{f.name} is repeated", f.state)
    seen[f.name] = true

# new anonymous type
newType = (handlers) ->
  type = new TypeDescriptor()
  for h in handlers
    if typeof h[0] == "string"
      type.addValueHandler h[0], h[1]
    else
      type.addTypeHandler h[0], h[1]
  type

# convenience for "native" types
addHandlers = (type, typemap, table) ->
  handlers = []
  for k, v of table
    resultType = findType(parser.typedecl.run(v), typemap)
    if k[0] == "."
      type.addValueHandler k[1...], resultType
    else
      type.addTypeHandler findType(parser.typedecl.run(k), typemap), resultType


exports.addHandlers = addHandlers
exports.buildType = buildType
exports.CompoundType = CompoundType
exports.findType = findType
exports.FunctionType = FunctionType
exports.NamedType = NamedType
exports.newType = newType
exports.TypeDescriptor = TypeDescriptor
