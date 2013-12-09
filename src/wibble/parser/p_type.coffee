pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'

commaSeparated = p_common.commaSeparated
linespace = p_common.linespace
SYMBOL_NAME = p_common.SYMBOL_NAME
TYPE_NAME = p_common.TYPE_NAME

#
# parse type declarations
#

simpleType = pr.alt("@", pr(TYPE_NAME).onMatch((m) -> m[0])).onMatch (m) ->
  { type: m }

namedType = pr([ pr([ SYMBOL_NAME, linespace, pr(":").drop(), linespace ]).optional([]), (-> typedecl) ]).onMatch (m) ->
  if m[0].length > 0
    { namedType: m[1], name: m[0][0][0] }
  else
    m[1]

compoundType = pr([ pr("(").drop(), commaSeparated(namedType), pr(")").drop() ]).onMatch (m) ->
  { compoundType: m[0] }

functionType = pr([ (-> typedecl), linespace, pr("->").drop(), linespace, (-> typedecl) ]).onMatch (m) ->
  { functionType: m[1], argType: m[0] }

templateType = pr([ TYPE_NAME, pr("(").drop(), commaSeparated(-> typedecl), pr(")").drop() ]).onMatch (m) ->
  { templateType: m[0][0], parameters: m[1] }

typedecl = pr.alt(templateType, simpleType, compoundType, functionType).onFail("Expected type")

exports.typedecl = typedecl
