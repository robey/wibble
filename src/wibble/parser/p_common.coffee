pr = require 'packrattle'

#
# common regexs and definitions used by different parsers
#

SYMBOL_NAME = /[a-z][A-Za-z_0-9]*/

TYPE_NAME = /[A-Z][A-Za-z_0-9]*/

RESERVED = [
  "then"
  "else"
  "match"
  "true"
  "false"
  "and"
  "or"
  "on"
  "val"
  "def"
]

OPERATORS = [
  "**"
  "*"
  "/"
  "%"
  "+"
  "-"
  "<<"
  ">>"
  "=="
  "!="
  ">="
  "<="
  ">"
  "<"
]

# line may be continued with "\"
linespace = pr(/([ ]+|\\\n)*/).optional().drop()

whitespace = pr(/[ \n]*/).optional().drop()

commaSeparated = (p) ->
  pr.repeat([ whitespace, p, whitespace, pr(",").optional().drop() ]).onMatch (m) ->
    m.map (x) -> x[0]

exports.commaSeparated = commaSeparated
exports.linespace = linespace
exports.OPERATORS = OPERATORS
exports.RESERVED = RESERVED
exports.SYMBOL_NAME = SYMBOL_NAME
exports.TYPE_NAME = TYPE_NAME
exports.whitespace = whitespace
