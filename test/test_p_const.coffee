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
    parse("23").should.eql(number: "base10", value: "23")
    parse("0").should.eql(number: "base10", value: "0")
    parse("-919").should.eql(number: "base10", value: "-919")
    parse("12345L").should.eql(number: "long-base10", value: "12345")

  it "float", ->
    parse("1.2").should.eql(number: "float", value: "1.2")
    parse("-500.2L").should.eql(number: "long-float", value: "-500.2")

  it "hex", ->
    parse("0x9").should.eql(number: "base16", value: "9")
    parse("0xff1L").should.eql(number: "long-base16", value: "ff1")
    parseFailed("0x3qqq").should.match(/Hex constant must contain only/)

  it "binary", ->
    parse("0b11").should.eql(number: "base2", value: "11")
    parse("0b1010L").should.eql(number: "long-base2", value: "1010")
    parseFailed("0b11qqq").should.match(/Binary constant must contain only/)

  it "boolean", ->
    parse("true").should.eql(boolean: true)
    parse("false").should.eql(boolean: false)

  it "nothing", ->
    parse("()").should.eql(nothing: true)

  it "symbol", ->
    parse(".hello").should.eql(symbol: "hello")
    parse(".xx_").should.eql(symbol: "xx_")
    parse(".a3").should.eql(symbol: "a3")

  it "opref", ->
    parse(".+").should.eql(symbol: "+")
    parse(".>").should.eql(symbol: ">")
    parse(".>>").should.eql(symbol: ">>")
    parseFailed(".?").should.match(/Invalid symbol/)

  describe "string", ->
    it "empty", ->
      parse('""').should.eql(string: "")

    it "simple", ->
      parse('"hello"').should.eql(string: "hello")

    it "with quotes", ->
      parse('"quote \\" ha"').should.eql(string: "quote \" ha")

    it "with escapes", ->
      parse('"\\e[34m"').should.eql(string: "\u001b[34m")
      parseFailed('"\\u99"').should.match(/Illegal/)
      parseFailed('"\\ucats"').should.match(/Illegal/)
      parse('"what\\u2022?"').should.eql(string: "what\u2022?")
      parse('"what\\nup\\rup"').should.eql(string: "what\nup\rup")

    it "unterminated", ->
      parseFailed('"hello').should.match(/Unterminated string/)

  it "gibberish", ->
    parseFailed("^^^").should.match(/Expected constant/)

