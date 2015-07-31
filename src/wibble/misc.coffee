
cstring = (s) ->
  s.replace /[^\u0020-\u007e]|\"/g, (c) ->
    if c == '"' then return "\\\""
    n = c.charCodeAt(0)
    switch n
      when 8 then "\\b"
      when 9 then "\\t"
      when 10 then "\\n"
      when 13 then "\\r"
      when 27 then "\\e"
      else
        escape = "000" + n.toString(16)
        "\\u" + escape[escape.length - 4 ...]

spaces = (count) ->
  ([0 ... count].map (n) -> " ").join("")

pad = (s, count) ->
  if s.length >= count then return s
  pad(" " + s, count)


exports.cstring = cstring
exports.pad = pad
exports.spaces = spaces
exports.uncstring = uncstring
