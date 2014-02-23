p_code = require './parser/p_code'
p_common = require './parser/p_common'
p_expr = require './parser/p_expr'
p_type = require './parser/p_type'

# return true if the error state position is "morally equivalent" to the
# end of the string. this usually means that the expression is incomplete,
# and "typing more" may help.
couldContinue = (line, state) ->
  if state.pos() == line.length then return true
  try
    p_common.whitespace.run(line[state.pos()...] + "\n")
    return true
  catch e
    # ignore
    return false

exports.code = p_code.code
exports.couldContinue = couldContinue
exports.expression = p_expr.expression
exports.typedecl = p_type.typedecl
exports.whitespace = p_common.whitespace
