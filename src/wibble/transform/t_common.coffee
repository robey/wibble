error = (message, state) ->
  e = new Error(message)
  e.state = state
  throw e

# FIXME this is known to be slow.
copy = (obj, changes) ->
  rv = {}
  for k, v of obj when changes[k] != null then rv[k] = v
  for k, v of changes then rv[k] = v
  Object.freeze(rv)


exports.copy = copy
exports.error = error
