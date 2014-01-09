packrattle = require 'packrattle'
util = require 'util'

parseWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(true)
  if rv.match.state?
    rv.match.pos = [ rv.match.state.pos, rv.match.state.endpos ]
    delete rv.match.state
  rv.match

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
