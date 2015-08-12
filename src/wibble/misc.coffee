
spaces = (count) ->
  ([0 ... count].map (n) -> " ").join("")

pad = (s, count) ->
  if s.length >= count then return s
  pad(" " + s, count)


exports.cstring = cstring
exports.pad = pad
exports.spaces = spaces
exports.uncstring = uncstring
