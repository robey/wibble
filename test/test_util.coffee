packrattle = require 'packrattle'
util = require 'util'

# convert the (large, unwieldy) state object into the raw position ints, for
# easy testing.
stateToPos = (x) ->
  return x unless typeof x == "object"
  if Array.isArray(x) then return x.map(stateToPos)
  if x.state?
    x.pos = [ x.state.pos, x.state.endpos ]
    delete x.state
  for k, v of x then if k != 'pos' then x[k] = stateToPos(v)
  x

parseWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(true)
  stateToPos(rv.match)

parseFailedWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(false)
  rv.message

DEBUG = { debugger: { debug: console.log, info: console.log } }
INFO = { debugger: { info: console.log } }


exports.DEBUG = DEBUG
exports.INFO = INFO
exports.parseWith = parseWith
exports.parseFailedWith = parseFailedWith
