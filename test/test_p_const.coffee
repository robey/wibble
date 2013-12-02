packrattle = require 'packrattle'
should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_const = require "#{wibble}/parser/p_const"

parseWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(true)
  rv.match
parseFailedWith = (parser, line, options) ->
  rv = packrattle.consume(parser, line, options)
  rv.ok.should.eql(false)
  rv.message

describe "Parse", ->
  describe "constants", ->
    parse = (line, options) -> parseWith(p_const.constant, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_const.constant, line, options)

    it "int", ->
      parse("23").should.eql(number: "base10", value: "23")
      parse("0").should.eql(number: "base10", value: "0")
      parse("-919").should.eql(number: "base10", value: "-919")
      parse("12345L").should.eql(number: "long-base10", value: "12345")

    it "real", ->
      parse("1.2").should.eql(number: "real", value: "1.2")
      parse("-500.2L").should.eql(number: "long-real", value: "-500.2")

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
      parse("hello").should.eql(symbol: "hello")
      parse("xx_").should.eql(symbol: "xx_")
      parse("a3").should.eql(symbol: "a3")

    it "symbolref", ->
      parse(":hello").should.eql(symbol: "hello")
      parse(":true").should.eql(symbol: "true")

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

      it "unterminated", ->
        parseFailed('"hello').should.match(/Unterminated string/)

    describe "array", ->
      it "empty", ->
        parse("[]").should.eql(array: [])
        parse("[  ]").should.eql(array: [])

      it "single", ->
        parse("[ 3 ]").should.eql(array: [ { number: "base10", value: "3" } ])

      it "multiple", ->
        parse("[ true, true, false ]").should.eql(array: [ { boolean: true }, { boolean: true }, { boolean: false } ])

      it "trailing comma", ->
        parse("[9,]").should.eql(array: [ { number: "base10", value: "9" } ])

      it "nested", ->
        parse("[ [true], [false] ]").should.eql(array: [
          { array: [ { boolean: true } ] }
          { array: [ { boolean: false } ] }
        ])

      it "multi-line", ->
        parse("[\n  true\n  false\n]").should.eql(array: [ { boolean: true }, { boolean: false } ])

    describe "map", ->
      it "empty", ->
        parse("{}").should.eql(map: [])
        parse("{  }").should.eql(map: [])
        
      it "single", ->
        parse("{ 3: \"\" }").should.eql(map: [ [ { number: "base10", value: "3" }, { string: "" } ] ])

      it "multiple", ->
        parse("{ true: \"a\", false: \"b\" }").should.eql(map: [ [ { boolean: true }, { string: "a" } ], [ { boolean: false }, { string: "b" } ] ])

      it "trailing comma", ->
        parse("{\"a\":true,}").should.eql(map: [ [ { string: "a" }, { boolean: true } ] ])

      it "nested", ->
        parse("{ \"a\":{ \"b\": false }}").should.eql(map: [
          [
            { string: "a" }, { map: [
              [ { string: "b" }, { boolean: false } ]
            ]}
          ]
        ])

      it "multi-line", ->
        parse("{\n  \"a\": true\n  \"b\": false\n}").should.eql(map: [
          [ { string: "a" }, { boolean: true } ],
          [ { string: "b" }, { boolean: false } ]
        ])

    it "gibberish", ->
      parseFailed("^^^").should.match(/Expected constant/)

