util = require 'util'
types = require './types'

DefaultTypemap =
  "Any": types.WAnyType
  "Int": types.WIntType
  "Nothing": types.WNothingType
  "String": types.WStringType
  "Symbol": types.WSymbolType

error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

# turn a "type" from the AST into a WType
# 'typemap' may contain (name -> WType)
evalType = (ast, typemap = DefaultTypemap) ->
  if ast.typename?
    if not typemap[ast.typename]? then error("Unknown type: #{ast.typename}", ast.state)
    return typemap[ast.typename]
  if ast.functionType?
    return new types.WFunctionType(evalType(ast.argType, typemap), evalType(ast.functionType, typemap))
  if ast.compoundType?
    fields = []
    for f in ast.compoundType
      # FIXME default value
      fields.push(new types.WField(f.name, evalType(f.type, typemap)))
    return new types.WStructType(fields)
  # { templateType: string, parameters: type* }
  error("Not yet implemented", ast.state)


exports.evalType = evalType
