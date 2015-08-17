pr = require 'packrattle'
util = require 'util'

#require("source-map-support").install()

#
# common regexs and definitions used by different parsers
#


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
