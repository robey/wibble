pr = require 'packrattle'
util = require 'util'
p_common = require './p_common'
misc = require '../misc'

commaSeparated = p_common.commaSeparated
OPERATORS = p_common.OPERATORS
SYMBOL_NAME = p_common.SYMBOL_NAME

#
# parse constants
#

# { nothing: true }
nothing = pr("()").onMatch (x) -> { nothing: true }

# { boolean: true/false }
boolean = pr.alt("true", "false").onMatch (m) -> { boolean: m == "true" }

# { number: base2/base10/base16/long-base2/long-base10/long-base16/real/long-real, value: "" }
numberBase16 = pr([ pr("0x").commit().drop(), /\w+/ ]).onMatch (m) ->
  checkBase m[0][0], /^[0-9a-fA-F]+$/, "base16", "Hex constant must contain only 0-9, A-F"

numberBase2 = pr([ pr("0b").commit().drop(), /\w+/ ]).onMatch (m) ->
  checkBase m[0][0], /^[01]+$/, "base2", "Binary constant must contain only 0, 1"

checkBase = (content, regex, name, errorMessage) ->
  isLong = false
  if content[content.length - 1] == "L"
    content = content[0 ... content.length - 1]
    isLong = true
  if not content.match(regex) then throw new Error(errorMessage)
  { number: (if isLong then "long-#{name}" else name), value: content }

number = pr(/-?[0-9]+(\.[0-9]+)?(L?)/).onMatch (m) ->
  hasDot = m[0].indexOf(".") >= 0
  if m[2] == "L"
    { number: (if hasDot then "long-float" else "long-base10"), value: m[0].slice(0, m[0].length - 1) }
  else
    { number: (if hasDot then "float" else "base10"), value: m[0] }

# { string: "" }
cstring = pr([ pr(/"(([^"\\]|\\.)*)/).commit(), pr('"').onFail("Unterminated string") ]).onMatch (m) ->
  { string: misc.uncstring(m[0][1]) }

symbolRef = pr([
  pr(".").commit().drop()
  pr.alt(
    pr(SYMBOL_NAME).onMatch((m) -> m[0]),
    OPERATORS...
  ).onFail("Invalid symbol name after .")
]).onMatch (m) ->
  { symbol: m[0] }

constant = pr.alt(nothing, boolean, numberBase16, numberBase2, number, cstring, symbolRef).describe("constant")


exports.constant = constant
