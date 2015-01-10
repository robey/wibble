pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
p_expr = require './p_expr'

linespace = p_common.linespace
repeatSurrounded = p_common.repeatSurrounded
SYMBOL_NAME = p_common.SYMBOL_NAME
TYPE_NAME = p_common.TYPE_NAME

#
# parse type declarations
#

simpleType = pr.alt("@", pr(TYPE_NAME).onMatch((m) -> m[0])).onMatch (m, state) ->
  { typename: m, state }

namedType = pr([
  pr(SYMBOL_NAME).onMatch((m, state) -> { name: m[0], state })
  pr([ linespace, pr(":").drop(), linespace, (-> typedecl) ]).optional([])
  pr([ linespace, pr("=").drop(), linespace, (-> p_expr.expression) ]).optional([])
]).onMatch (m) ->
  { name: m[0].name, type: m[1][0], value: m[2][0], state: m[0].state }

compoundType = repeatSurrounded("(", namedType, ",", ")", linespace, "Expected named type").onMatch (m, state) ->
  { compoundType: m.items, state }

functionType = pr([ (-> typedecl), linespace, pr("->").commit().drop(), linespace, (-> typedecl) ]).onMatch (m, state) ->
  { functionType: m[1], argType: m[0], state }

templateType = pr([ TYPE_NAME, repeatSurrounded("(", (-> typedecl), ",", ")", linespace, "Expected type") ]).onMatch (m, state) ->
  { templateType: m[0][0], parameters: m[1].items, state }

nestedType = pr([ pr("(").drop(), (-> typedecl), pr(")").drop() ]).onMatch (m, state) ->
  m[0]

parameterType = pr([ pr("$").drop(), pr(TYPE_NAME).onMatch((m) -> m[0]) ]).onMatch (m, state) ->
  { parameterType: m[0], state }

componentType = pr.alt(nestedType, parameterType, templateType, simpleType, compoundType, functionType)

divergentTypes = pr.repeat([ linespace, pr("|").commit().drop(), linespace, componentType ]).onMatch (m) ->
  m.map (item) -> item[0]

disjointType = pr([ componentType, divergentTypes ]).onMatch (m, state) ->
  if m[1].length == 0 then return m[0]
  { disjointType: [ m[0] ].concat(m[1]), state }

typedecl = disjointType.onFail("Expected type")


exports.compoundType = compoundType
exports.typedecl = typedecl
