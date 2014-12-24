util = require 'util'
dump = require '../dump'
parser = require '../parser'
t_common = require './t_common'

error = t_common.error

#
# type descriptors used during the transform/compile phase, for type checking.
# the runtime also uses these as the primary reference for a runtime type.
#

# valueHandlers: { guard: string, type: TypeDescriptor }
# typeHandlers: { guard: TypeDescriptor, type: TypeDescriptor }
class TypeDescriptor
  constructor: (@valueHandlers = [], @typeHandlers = []) ->

  isDefined: ->
    for v in @valueHandlers then if not v.type.isDefined() then return false
    for v in @typeHandlers then if not v.type.isDefined() then return false
    true

  # SelfType wraps another type, so allow lookups to flatten these kind of annotated references
  flatten: -> @

  equals: (other) -> @ == other

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
      for h in @typeHandlers then if h.guard.canCoerceFrom(type.flatten()) then return h.type.flatten()
    # FIXME warning: not type checked
    descriptors = require './descriptors'
    descriptors.DAny

  addValueHandler: (value, htype) -> @valueHandlers.push { guard: value, type: htype }

  addTypeHandler: (type, htype) -> @typeHandlers.push { guard: type, type: htype }

  fillInType: (id, type) ->
    for h in @valueHandlers then if (not h.type.isDefined()) and h.type.id == id then h.type = type
    for h in @typeHandlers then if (not h.type.isDefined()) and h.type.id == id then h.type = type


class NamedType extends TypeDescriptor
  constructor: (@name) ->
    super()

  isDefined: -> true

  equals: (other) ->
    other = other.flatten()
    (other instanceof NamedType) and @name == other.name

  toRepr: (precedence = true) -> @name


class SelfType extends TypeDescriptor
  constructor: (@type) ->
    super()

  isDefined: -> @type.isDefined()

  flatten: -> @type

  equals: (other) -> @type.equals(other)

  canCoerceFrom: (other) -> @type.canCoerceFrom(other)

  toRepr: (precedence = true) -> "@"

  handlerTypeForMessage: (type, expr) -> @type.handlerTypeForMessage(type, expr)


# fields are { name, type, value: expr }
class CompoundType extends TypeDescriptor
  constructor: (@fields) ->
    super()
    # field accessors
    for f in @fields then @addValueHandler f.name, f.type

  isDefined: ->
    for f in @fields then if not f.type.isDefined() then return false
    true

  equals: (other) ->
    other = other.flatten()
    if not (other instanceof CompoundType) then return false
    if other.fields.length != @fields.length then return false
    otherFields = {}
    for f in other.fields then otherFields[f.name] = f.type
    for f in @fields then if not (otherFields[f.name]? and f.type.equals(otherFields[f.name])) then return false
    true

  canCoerceFrom: (other) ->
    other = other.flatten()
    # allow zero-arg to be equivalent to an empty struct, and one-arg to be a single-element struct
    if not (other instanceof CompoundType)
      if other.equals(new NamedType("Nothing"))
        other = new CompoundType([])
      else
        other = new CompoundType([ name: "?0", type: other ])
    # check loose equality of compound types
    if @equals(other) then return true
    if @looselyMatches(other.fields) then return true
    # special case: if we're a one-field struct that is itself a struct, we have to go deeper.
    if @fields.length == 1 and (@fields[0].type instanceof CompoundType) and @fields[0].type.looselyMatches(other.fields) then return true
    false

  looselyMatches: (fields) ->
    # check for loose matching:
    # - no extra fields
    # - positional fields have the right type
    # - all missing fields have default values
    remaining = {}
    for f in @fields then remaining[f.name] = { type: f.type, hasDefault: f.value? }
    for f, i in fields
      if f.name[0] == "?"
        # positional
        if i >= @fields.length then return false
        name = @fields[i].name
      else
        name = f.name
      if not remaining[name]? then return false
      if not remaining[name].type.flatten().canCoerceFrom(f.type.flatten()) then return false
      delete remaining[name]
    for k, v of remaining then if not v.hasDefault then return false
    true

  toRepr: (precedence = true) ->
    fields = @fields.map (f) -> f.name + ": " + f.type.toRepr(true) + (if f.value? then " = " + dump.dumpExpr(f.value) else "")
    "(" + fields.join(", ") + ")"


class FunctionType extends TypeDescriptor
  constructor: (@argType, @functionType) ->
    super()
    @addTypeHandler @argType, @functionType

  isDefined: ->
    @argType.isDefined() and @functionType.isDefined()

  equals: (other) ->
    other = other.flatten()
    if not (other instanceof FunctionType) then return false
    other.argType.equals(@argType) and other.functionType.equals(@functionType)

  toRepr: (precedence = true) ->
    rv = @argType.toRepr(true) + " -> " + @functionType.toRepr(false)
    if precedence then rv else "(#{rv})"


# FIXME template type


class DisjointType extends TypeDescriptor
  constructor: (@options) ->
    super()

  isDefined: ->
    for t in @options then if not t.isDefined() then return false
    true

  equals: (other) ->
    other = other.flatten()
    if not (other instanceof DisjointType) then return false
    if @options.length != other.options.length then return false
    for i in [0 ... @options.length] then if not (@options[i].equals(other.options[i])) then return false
    true

  toRepr: (precedence = true) ->
    rv = @options.map((t) -> t.toRepr(true)).join(" | ")
    if precedence then rv else "(#{rv})"


# convert an AST type into a type descriptor
buildType = (type) ->
  if type.typename? then return new NamedType(type.typename)
  if type.compoundType?
    checkCompoundType(type)
    fields = type.compoundType.map (f) -> { name: f.name, type: buildType(f.type), value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(buildType(type.argType), buildType(type.functionType))
  if type.disjointType?
    options = type.disjointType.map (t) -> buildType(t)
    return new DisjointType(options)
  error "Not implemented yet: template type"

findType = (type, typemap) ->
  if type.typename?
    if not typemap.get(type.typename)? then error("Unknown type '#{type.typename}'", type.state)
    return typemap.get(type.typename)
  if type.compoundType?
    descriptors = require './descriptors'
    checkCompoundType(type)
    fields = type.compoundType.map (f) ->
      # FIXME warning: not type checked
      type = if f.type? then findType(f.type, typemap) else descriptors.DAny
      { name: f.name, type, value: f.value }
    return new CompoundType(fields)
  if type.functionType? then return new FunctionType(findType(type.argType, typemap), findType(type.functionType, typemap))
  if type.disjointType?
    options = type.disjointType.map (t) -> findType(t, typemap)
    return new DisjointType(options)
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
exports.DisjointType = DisjointType
exports.findType = findType
exports.FunctionType = FunctionType
exports.NamedType = NamedType
exports.newType = newType
exports.SelfType = SelfType
exports.TypeDescriptor = TypeDescriptor
