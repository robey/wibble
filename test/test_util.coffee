packrattle = require 'packrattle'
util = require 'util'

# convert the (large, unwieldy) state object into the raw position ints, for
# easy testing.
stateToPos = (x) ->
  copy = (changes) ->
    rv = {}
    for k, v of x when not (k in [ "scope", "state" ]) then rv[k] = stateToPos(v)
    for k, v of changes then rv[k] = v
    Object.freeze(rv)

  return x unless x? and (typeof x == "object")
  if Array.isArray(x) then return x.map(stateToPos)
  if x.state? then return copy(pos: [ x.state.pos, x.state.endpos ])
  copy()

parseWith = (parser, line, options) ->
  rv = parser.run(line, options)
  stateToPos(rv)

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
exports.stateToPos = stateToPos
