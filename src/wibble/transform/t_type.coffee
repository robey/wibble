util = require 'util'
dump = require '../dump'
parser = require '../parser'
t_common = require './t_common'

error = t_common.error

#
# type descriptors used during the transform/compile phase, for type checking.
# the runtime also uses these as the primary reference for a runtime type.
#

# valueHandlers: Map(guard: string -> type: TypeDescriptor)
# typeHandlers: List[{ guard: TypeDescriptor, type: TypeDescriptor }]
class TypeDescriptor
  constructor: (@valueHandlers = {}, @typeHandlers = []) ->

  isDefined: ->
    for guard, type of @valueHandlers then if not type.isDefined() then return false
    for v in @typeHandlers then if not v.type.isDefined() then return false
    true

  # SelfType wraps another type, so allow lookups to flatten these kind of annotated references
  flatten: -> @

  # fill in any "$A"-style type parameters from this map, returning a new TypeDescriptor if necessary.
  resolveParameters: (parameterMap) -> @

  equals: (other) -> @ == other

  # can 'other' be passed to this type?
  # if there are type parameters (like "$A"), parameterMap will map them to concrete types.
  canCoerceFrom: (other, parameterMap = {}) ->
    @equals(other)

  inspect: (precedence = true) -> @toDescriptor()

  toDescriptor: ->
    valueHandlers = for guard, type of @valueHandlers
      prefix = if guard[0] == ":" then "" else "."
      "#{prefix}#{guard} -> #{type.inspect(false)}"
    typeHandlers = @typeHandlers.map (h) -> "#{h.guard.inspect(true)} -> #{h.type.inspect(false)}"
    # make a pretty shorthand for the simple function type
    if valueHandlers.length == 0 and typeHandlers.length == 1
      typeHandlers[0]
    else
      "[" + valueHandlers.concat(typeHandlers).join(", ") + "]"

  handlerTypeForMessage: (type, expr) ->
    # allow "expr" to be a string, too, for native methods.
    if expr.symbol? then expr = expr.symbol
    if typeof expr == "string"
      for guard, type of @valueHandlers then if expr == guard then return type
    else
      for h in @typeHandlers
        parameterMap = {}
        if h.guard.canCoerceFrom(type.flatten(), parameterMap)
          return h.type.resolveParameters(parameterMap)
    # FIXME warning: not type checked
    descriptors = require './descriptors'
    descriptors.DAny

  addValueHandler: (value, htype) -> @valueHandlers[value] = htype

  addTypeHandler: (type, htype) -> @typeHandlers.push { guard: type, type: htype }

  fillInType: (id, type) ->
    for guard, t of @valueHandlers then if (not t.isDefined()) and t.id == id then @valueHandlers[guard] = type
    for h in @typeHandlers then if (not h.type.isDefined()) and h.type.id == id then h.type = type


class NamedType extends TypeDescriptor
  constructor: (@name) ->
    super()

  isDefined: -> true

  equals: (other) ->
    other = other.flatten()
    (other instanceof NamedType) and @name == other.name

  inspect: (precedence = true) -> @name


class ParameterType extends TypeDescriptor
  constructor: (@name) ->
    super()

  isDefined: -> true

  resolveParameters: (parameterMap) -> parameterMap[@name]

  equals: (other) ->
    other = other.flatten()
    (other instanceof ParameterType) and @name == other.name

  canCoerceFrom: (other, parameterMap = {}) ->
    # i'm a wildcard! i can coerce anything! tag, you're it!
    parameterMap[@name] = other
    true

  inspect: (precedence = true) -> @name


class SelfType extends TypeDescriptor
  constructor: (@type) ->
    super()

  isDefined: -> @type.isDefined()

  flatten: -> @type

  resolveParameters: (parameterMap) -> @type.resolveParameters(parameterMap)

  equals: (other) -> @type.equals(other)

  canCoerceFrom: (other, parameterMap = {}) -> @type.canCoerceFrom(other, parameterMap)

  inspect: (precedence = true) -> "@"

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

  resolveParameters: (parameterMap) ->
    new CompoundType(@fields.map (f) -> { name: f.name, type: f.type.resolveParameters(parameterMap), value: f.value })

  equals: (other) ->
    other = other.flatten()
    if not (other instanceof CompoundType) then return false
    if other.fields.length != @fields.length then return false
    otherFields = {}
    for f in other.fields then otherFields[f.name] = f.type
    for f in @fields then if not (otherFields[f.name]? and f.type.equals(otherFields[f.name])) then return false
    true

  canCoerceFrom: (other, parameterMap = {}) ->
    @coercionKind(other, parameterMap)?

  # (only for structs) figure out what kind of coercion will work, and return it
  coercionKind: (other, parameterMap = {}) ->
    other = other.flatten()
    kind = null
    # allow zero-arg to be equivalent to an empty struct, and one-arg to be a single-element struct
    if other instanceof CompoundType
      kind = "compound"
    else
      if other.equals(new NamedType("Nothing"))
        kind = "nothing"
        other = new CompoundType([])
      else
        kind = "single"
        other = new CompoundType([ name: "?0", type: other ])
    # check loose equality of compound types
    if @equals(other) then return kind
    if @looselyMatches(other.fields, parameterMap) then return kind
    # special case: if we're a one-field struct that is itself a struct, we have to go deeper.
    if @fields.length == 1 and (@fields[0].type instanceof CompoundType) and @fields[0].type.looselyMatches(other.fields, parameterMap) then return "nested"
    null

  looselyMatches: (fields, parameterMap) ->
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
      if not remaining[name].type.flatten().canCoerceFrom(f.type.flatten(), parameterMap) then return false
      delete remaining[name]
    for k, v of remaining then if not v.hasDefault then return false
    true

  inspect: (precedence = true) ->
    fields = @fields.map (f) -> f.name + ": " + f.type.inspect(true) + (if f.value? then " = " + dump.dumpExpr(f.value) else "")
    "(" + fields.join(", ") + ")"


# user-defined classes (or functions) -- use hard-core matching
class UserType extends TypeDescriptor
  constructor: ->
    super()

  # is every single handler type the same?
  equals: (other, cache = []) ->
    other = other.flatten()
    # shortcut if they're the same reference or cached
    if @ == other then return true
    for [ x, y ] in cache then if x == @ and y == other then return true
    if Object.keys(@valueHandlers).length != Object.keys(other.valueHandlers).length then return false
    if @typeHandlers.length != other.typeHandlers.length then return false
    # preempt any recursive loops:
    cache.push [ @, other ]
    # every value handler must match
    for guard, type in @valueHandlers
      if (not other.valueHandlers[guard]?) or (not type.equals(other.valueHandlers[guard], cache)) then return false
    # every type handler must match
    for handler in @typeHandlers
      # node is missing Array#find.
      oh = other.typeHandlers.filter (h) -> handler.guard.equals(h.guard, cache) and handler.type.equals(h.type, cache)
      if oh.length < 1 then return false
    true

  # does every handler have a matching coerce-from one?
  canCoerceFrom: (other, parameterMap = {}, cache = []) ->
    other = other.flatten()
    # shortcut if they're the same reference or cached
    if @ == other then return true
    for [ x, y ] in cache then if x == @ and y == other then return true
    # preempt any recursive loops:
    cache.push [ @, other ]
    # every value handler must coerce
    for guard, type in @valueHandlers
      if (not other.valueHandlers[guard]?) or (not type.canCoerceFrom(other.valueHandlers[guard], parameterMap, cache)) then return false
    # every type handler must coerce
    for handler in @typeHandlers
      # node is missing Array#find.
      oh = other.typeHandlers.filter (h) ->
        # use the reverse coercion on the arg, so "Int -> Int" can accept "(n: Int) -> Int"
        h.guard.canCoerceFrom(handler.guard, parameterMap, cache) and handler.type.canCoerceFrom(h.type, parameterMap, cache)
      # FIXME should pick the best match, not the first.
      if oh.length < 1 then return false
    true

  # for internal optimizations: is this basically a function? (one handler, guarded by type)
  isFunction: ->
    Object.keys(@valueHandlers).length == 0 and @typeHandlers.length == 1


# convenience: make a user type for a single function
functionType = (argType, functionType) ->
  type = new UserType()
  type.addTypeHandler argType, functionType
  type


# FIXME template type


class DisjointType extends TypeDescriptor
  constructor: (@options) ->
    super()

  isDefined: ->
    for t in @options then if not t.isDefined() then return false
    true

  resolveParameters: (parameterMap) ->
    new DisjointType(@options.map (t) -> t.resolveParameters(parameterMap)).mergeIfPossible()

  equals: (other) ->
    other = other.flatten()
    if not (other instanceof DisjointType) then return false
    if @options.length != other.options.length then return false
    for i in [0 ... @options.length] then if not (@options[i].equals(other.options[i])) then return false
    true

  inspect: (precedence = true) ->
    rv = @options.map((t) -> t.inspect(true)).join(" | ")
    if precedence then rv else "(#{rv})"

  # try to unify.
  mergeIfPossible: ->
    for i in [0 ... @options.length]
      for j in [i + 1 ... @options.length]
        continue unless @options[i]? and @options[j]?
        if @options[i].equals(@options[j])
          @options[j] = null
          continue
        continue if @options[i] instanceof ParameterType
        if @options[i].canCoerceFrom(@options[j])
          @options[j] = null
        else if @options[j].canCoerceFrom(@options[i])
          @options[i] = null
    types = @options.filter (x) -> x?
    if types.length == 1 then types[0] else new DisjointType(types)


# convert an AST type into a type descriptor
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
  if type.functionType? then return functionType(findType(type.argType, typemap), findType(type.functionType, typemap))
  if type.disjointType?
    options = type.disjointType.map (t) -> findType(t, typemap)
    return new DisjointType(options)
  if type.parameterType?
    name = "$" + type.parameterType
    t = typemap.get(name)
    if t? then return t
    t = new ParameterType(name)
    typemap.add(name, t)
    return t
  error "Not implemented yet: template type"

# check for repeated fields before it's too late
checkCompoundType = (type) ->
  seen = {}
  for f in type.compoundType
    if seen[f.name] then error("Field name #{f.name} is repeated", f.state)
    seen[f.name] = true

# new anonymous type
newType = (handlers) ->
  type = new UserType()
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
exports.CompoundType = CompoundType
exports.DisjointType = DisjointType
exports.findType = findType
exports.functionType = functionType
exports.NamedType = NamedType
exports.newType = newType
exports.ParameterType = ParameterType
exports.SelfType = SelfType
exports.TypeDescriptor = TypeDescriptor
exports.UserType = UserType
