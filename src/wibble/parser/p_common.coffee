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
  "is"
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

whitespace = pr(/\s*/).optional().drop()

commaSeparated = (p) ->
  pr.repeat([ whitespace, p, whitespace, pr(",").optional().drop() ])

exports.commaSeparated = commaSeparated
exports.OPERATORS = OPERATORS
exports.RESERVED = RESERVED
exports.SYMBOL_NAME = SYMBOL_NAME
exports.TYPE_NAME = TYPE_NAME
exports.whitespace = whitespace
