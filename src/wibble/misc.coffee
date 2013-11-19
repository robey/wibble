
exports.uncstring = (s) ->
  s.replace /\\(u(.{0,4})|.)/, (match, c, hex) ->
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
