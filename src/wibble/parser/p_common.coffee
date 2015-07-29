pr = require 'packrattle'
util = require 'util'

#require("source-map-support").install()

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
  "unless"
  "until"
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
whitespace = pr(/([ \n]+|\\\n|\#[^\n]*\n)+/).optional().drop()
commentspace = pr(/([ \n]+|\\\n|\#[^\n]*\n)+/).onMatch (m) ->
  m[0].split("\n").map((x) -> x.trim()).filter((x) -> x[0] == "#").join("\n")
.optional()

# match a keyword, commit on it, and turn it into its state (covering span)
toState = (p) ->
  pr(p).commit().onMatch((m, state) -> state)

# ws -- whitespace preceding 'p'.
# if it's not dropped, the ws will be added to each 'p' as 'comment'.
repeatSeparated = (p, separator, ws) ->
  middle = pr([ linespace, pr(separator).drop(), ws, p ]).onMatch (m) ->
    if m.length > 1
      if m[0].length > 0 then m[1].comment = m[0]
      m[1]
    else
      m[0]
  rv = pr([ ws, p, middle.repeat(), linespace, pr(separator).optional().drop() ]).onMatch (m) ->
    if m.length > 2
      if m[0].length > 0 then m[1].comment = m[0]
      [ m[1] ].concat(m[2])
    else
      [ m[0] ].concat(m[1])
  rv.optional([])

# same as repeatSeparated, but with a surrounding group syntax like [ ].
# ws -- whitespace preceding the close-group parser.
# message -- what you expected if a group member can't parse.
# if ws isn't dropped, it will be added as 'trailingComment'.
repeatSurrounded = (open, p, separator, close, ws, message) ->
  pr([
    pr(open).drop(),
    repeatSeparated(p, separator, ws),
    ws,
    pr(close).onFail(message).drop()
  ]).onMatch (m) ->
    rv = { items: m[0] }
    if m.length > 1 and m[1].length > 0
      rv.trailingComment = m[1]
    rv

# repeat 'p' separated by linefeeds or ; inside { }
blockOf = (p) ->
  repeatSurrounded pr("{").commit(), p, /[\n;]+/, pr("}").commit(), commentspace, "Expected code"


exports.blockOf = blockOf
exports.commentspace = commentspace
exports.repeatSurrounded = repeatSurrounded
exports.linespace = linespace
exports.OPERATORS = OPERATORS
exports.PRECEDENCE = PRECEDENCE
exports.RESERVED = RESERVED
exports.SYMBOL_NAME = SYMBOL_NAME
exports.toState = toState
exports.TYPE_NAME = TYPE_NAME
exports.whitespace = whitespace
