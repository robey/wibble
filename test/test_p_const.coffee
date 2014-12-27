packrattle = require 'packrattle'
should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_const = require "#{wibble}/parser/p_const"
test_util = require './test_util'

describe "Parse constants", ->
  parse = (line, options) -> test_util.parseWith(p_const.constant, line, options)
  parseFailed = (line, options) -> test_util.parseFailedWith(p_const.constant, line, options)

  it "int", ->
    parse("23").should.eql(number: "base10", value: "23", pos: [ 0, 2 ])
    parse("0").should.eql(number: "base10", value: "0", pos: [ 0, 1 ])
    parse("919").should.eql(number: "base10", value: "919", pos: [ 0, 3 ])
    parse("12345L").should.eql(number: "long-base10", value: "12345", pos: [ 0, 6 ])

  it "float", ->
    parse("1.2").should.eql(number: "float", value: "1.2", pos: [ 0, 3 ])
    parse("500.2L").should.eql(number: "long-float", value: "500.2", pos: [ 0, 6 ])

  it "hex", ->
    parse("0x9").should.eql(number: "base16", value: "9", pos: [ 0, 3 ])
    parse("0xff1L").should.eql(number: "long-base16", value: "ff1", pos: [ 0, 6 ])
    parseFailed("0x3qqq").should.match(/Hex constant must contain only/)

  it "binary", ->
    parse("0b11").should.eql(number: "base2", value: "11", pos: [ 0, 4 ])
    parse("0b1010L").should.eql(number: "long-base2", value: "1010", pos: [ 0, 7 ])
    parseFailed("0b11qqq").should.match(/Binary constant must contain only/)

  it "boolean", ->
    parse("true").should.eql(boolean: true, pos: [ 0, 4 ])
    parse("false").should.eql(boolean: false, pos: [ 0, 5 ])

  it "nothing", ->
    parse("()").should.eql(nothing: true, pos: [ 0, 2 ])

  it "symbol", ->
    parse(".hello").should.eql(symbol: "hello", pos: [ 0, 6 ])
    parse(".xx_").should.eql(symbol: "xx_", pos: [ 0, 4 ])
    parse(".a3").should.eql(symbol: "a3", pos: [ 0, 3 ])
    parse(":inspect").should.eql(symbol: ":inspect", pos: [ 0, 8 ])

  it "opref", ->
    parse(".+").should.eql(symbol: "+", pos: [ 0, 2 ])
    parse(".>").should.eql(symbol: ">", pos: [ 0, 2 ])
    parse(".>>").should.eql(symbol: ">>", pos: [ 0, 3 ])
    parseFailed(".?").should.match(/Invalid symbol/)

  describe "string", ->
    it "empty", ->
      parse('""').should.eql(string: "", pos: [ 0, 2 ])

    it "simple", ->
      parse('"hello"').should.eql(string: "hello", pos: [ 0, 7 ])

    it "with quotes", ->
      parse('"quote \\" ha"').should.eql(string: "quote \" ha", pos: [ 0, 13 ])

    it "with escapes", ->
      parse('"\\e[34m"').should.eql(string: "\u001b[34m", pos: [ 0, 8 ])
      parseFailed('"\\u99"').should.match(/Illegal/)
      parseFailed('"\\ucats"').should.match(/Illegal/)
      parse('"what\\u2022?"').should.eql(string: "what\u2022?", pos: [ 0, 13 ])
      parse('"what\\nup\\rup"').should.eql(string: "what\nup\rup", pos: [ 0, 14 ])

    it "unterminated", ->
      parseFailed('"hello').should.match(/Unterminated string/)

  it "gibberish", ->
    parseFailed("^^^").should.match(/Expected constant/)

