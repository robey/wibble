
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
