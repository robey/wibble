packrattle = require 'packrattle'
should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_expr = require "#{wibble}/parser/p_expr"
test_util = require './test_util'

parseWith = test_util.parseWith
parseFailedWith = test_util.parseFailedWith

describe "Parse expressions", ->
  parse = (line, options) -> parseWith(p_expr.expression, line, options)
  parseFailed = (line, options) -> parseFailedWith(p_expr.expression, line, options)

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
