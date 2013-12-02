packrattle = require 'packrattle'
util = require 'util'

parseWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(true)
  rv.match

parseFailedWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(false)
  rv.message


exports.parseWith = parseWith
exports.parseFailedWith = parseFailedWith
