pr = require 'packrattle'
util = require 'util'

#
# common regexs and definitions used by different parsers
#

SYMBOL_NAME = /[a-z][A-Za-z_0-9]*/

TYPE_NAME = /[A-Z][A-Za-z_0-9]*/

RESERVED = [
  "if"
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
  "new"
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
  code: 12
  none: 99

comment = pr(/\#[^\n]*/).drop()

# line may be continued with "\"
linespace = pr(/([ ]+|\\\n)*/).drop()

# linefeed is acceptable whitespace here
whitespace = pr(/([ \n]+|\\\n|\#[^\n]*\n)*/).drop()

# match a keyword, commit on it, and turn it into its state (covering span)
toState = (p) ->
  pr(p).commit().onMatch((m, state) -> state)

repeatSeparated = (p, separator, ws = linespace) ->
  middle = pr([ ws, pr(separator).drop(), ws, p ]).onMatch (m) -> m[0]
  foo = pr([ p, middle.repeat(), ws, pr(separator).optional().drop() ]).onMatch (m) ->
    [ m[0] ].concat(m[1])
  foo.optional([])

# repeat 'p' with optional whitespace around it, separated by commas, with a trailing comma OK
commaSeparated = (p) -> repeatSeparated(p, /,\s*/)

# same as commaSeparated, but with a surrounding group syntax like [ ], and committing after the open and close
commaSeparatedSurrounded = (open, p, close, message) ->
  pr([ pr(open).drop(), whitespace, commaSeparated(p), whitespace, pr(close).onFail(message).drop() ]).onMatch (m) -> m[0]

commaSeparatedSurroundedCommit = (open, p, close, message) ->
  pr([ pr(open).commit().drop(), whitespace, commaSeparated(p), whitespace, pr(close).onFail(message).commit().drop() ]).onMatch (m) -> m[0]

lineSeparated = (p) -> repeatSeparated(p, /[\n;]/)

# repeat 'p' separated by linefeeds or ; inside { }
blockOf = (p) ->
  pr([
    pr("{").commit().drop()
    whitespace
    lineSeparated(p).optional([])
    whitespace
    pr("}").commit().drop()
  ]).onMatch (m) -> m[0]


exports.blockOf = blockOf
exports.commaSeparated = commaSeparated
exports.commaSeparatedSurrounded = commaSeparatedSurrounded
exports.commaSeparatedSurroundedCommit = commaSeparatedSurroundedCommit
exports.linespace = linespace
exports.OPERATORS = OPERATORS
exports.PRECEDENCE = PRECEDENCE
exports.RESERVED = RESERVED
exports.SYMBOL_NAME = SYMBOL_NAME
exports.toState = toState
exports.TYPE_NAME = TYPE_NAME
exports.whitespace = whitespace
