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

simpleType = pr.alt("@", pr(TYPE_NAME).onMatch((m) -> m[0])).onMatch (m, state) ->
  { typename: m, state }

namedType = pr([ pr([ SYMBOL_NAME, linespace, pr(":").drop(), linespace ]).optional([]), (-> typedecl) ]).onMatch (m, state) ->
  if m[0].length > 0
    { namedType: m[1], name: m[0][0][0], state }
  else
    m[1]

compoundType = pr([ pr("(").drop(), commaSeparated(namedType), pr(")").drop() ]).onMatch (m, state) ->
  { compoundType: m[0], state }

functionType = pr([ (-> typedecl), linespace, pr("->").drop(), linespace, (-> typedecl) ]).onMatch (m, state) ->
  { functionType: m[1], argType: m[0], state }

templateType = pr([ TYPE_NAME, pr("(").drop(), commaSeparated(-> typedecl), pr(")").drop() ]).onMatch (m, state) ->
  { templateType: m[0][0], parameters: m[1], state }

typedecl = pr.alt(templateType, simpleType, compoundType, functionType).onFail("Expected type")


exports.typedecl = typedecl
