error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e


exports.error = error
