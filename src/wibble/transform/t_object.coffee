util = require 'util'
t_common = require './t_common'
t_expr = require './t_expr'

copy = t_common.copy
error = t_common.error

# "on" handlers must be in a "new" block, and a "new" block must contain at least one "on" handler.
checkHandlers = (expr) ->
  t_expr.digExpr expr, false, (expr, inNew) ->
    if expr.on? and not inNew
      error("'on' handlers must be inside a type definition or 'new' expression", expr.on.state)
    if expr.newObject?
      handlers = expr.newObject.code.filter (x) -> x.on?
      if handlers.length == 0
        error("'new' expression must contain at least one 'on' handler", expr.newObject.state)
    [ expr, expr.newObject? or (inNew and expr.code?) ]

# convert anonymous functions into new/on
crushFunctions = (expr) ->
  t_expr.digExpr expr, null, (expr, _) ->
    if not expr.functionx? then return expr
    handler =
      on: expr.parameters
      handler: expr.functionx
      type: expr.type
      state: expr.state
    copy(expr, functionx: null, type: null, parameters: null, newObject: { code: [ handler ] }, stateless: true)


exports.checkHandlers = checkHandlers
exports.crushFunctions = crushFunctions
