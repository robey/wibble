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

PRECEDENCE =
  constant: 1
  atom: 2
  unary: 3
  call: 4
  "**": 5
  "*": 6
  "/": 6
  "%": 6
  "+": 7
  "-": 7
  "<<": 8
  ">>": 8
  "==": 9
  "!=": 9
  ">=": 9
  "<=": 9
  ">": 9
  "<": 9
  "and": 10
  "or": 10
  ifThen: 11

# line may be continued with "\"
linespace = pr(/([ ]+|\\\n)*/).optional().drop()

whitespace = pr(/[ \n]*/).optional().drop()

commaSeparated = (p) ->
  pr.repeat([ whitespace, p, whitespace, pr(",").optional().drop() ]).onMatch (m) ->
    m.map (x) -> x[0]

exports.commaSeparated = commaSeparated
exports.linespace = linespace
exports.OPERATORS = OPERATORS
exports.PRECEDENCE = PRECEDENCE
exports.RESERVED = RESERVED
exports.SYMBOL_NAME = SYMBOL_NAME
exports.TYPE_NAME = TYPE_NAME
exports.whitespace = whitespace
