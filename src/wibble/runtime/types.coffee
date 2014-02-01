int = require './types/int'
nothing = require './types/nothing'
struct = require './types/struct'
symbol = require './types/symbol'

exports.TInt = int.TInt
exports.TNothing = nothing.TNothing
exports.TStruct = struct.TStruct
exports.TSymbol = symbol.TSymbol


# class WFunctionType extends WType
#   constructor: (@inType, @outType) ->
#     super("#{@inType.name} -> #{@outType.name}")

#   equals: (other) ->
#     (other instanceof WFunctionType) and (@inType.equals other.inType) and (@outType.equals other.outType)

# class WField
#   constructor: (@name, @type, @defaultExpr) ->

#   toRepr: ->
#     @name + ": " + @type.toRepr() + (if @defaultExpr? then (" = " + @defaultExpr.toRepr()) else "")

#   equals: (other) ->
#     @name == other.name and @type.equals(other.type)

# class WStructType extends WType
#   constructor: (@fields = []) ->
#     super("(" + @fields.map((f) -> f.toRepr()).join(", ") + ")")

#   equals: (other) ->
#     # FIXME don't require the same type order
#     if not (other instanceof WStructType) then return false
#     if not (@fields.length == other.fields.length) then return false
#     otherFields = {}
#     for f in other.fields then otherFields[f.name] = f
#     for f in @fields
#       if (not otherFields[f.name]?) or (not otherFields[f.name].type.equals(f.type)) then return false
#     true

#   canCoerceFrom: (other) ->
#     # a zero-element struct is the same as Nothing
#     if @fields.length == 0 and WNothingType.canCoerceFrom(other) then return true
#     # a one-element struct is the same as the type of that element (but do not recurse)
#     if @fields.length == 1 and @fields[0].type.equals(other) then return true
#     if @equals(other) then return true
#     return super(other)

