
exports.uncstring = (s) ->
  s.replace /\\(u(.{0,4})|.)/g, (match, c, hex) ->
    if hex?
      # uHHHH
      if not hex.match(/[0-9a-fA-F]{4}/)? then throw new Error("Illegal \\uHHHH code")
      return String.fromCharCode(parseInt(hex, 16))
    switch c
      when 'b' then "\u0008"
      when 'e' then "\u001b"
      when 'n' then "\n"
      when 'r' then "\r"
      when 't' then "\t"
      else c

exports.cstring = (s) ->
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

