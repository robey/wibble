packrattle = require 'packrattle'
should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_expr = require "#{wibble}/parser/p_expr"
test_util = require './test_util'

parseWith = test_util.parseWith
parseFailedWith = test_util.parseFailedWith

INFO = { debugger: { info: console.log } }

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

  describe "struct", ->
    it "without names", ->
      parse("(x, y)").should.eql(
        struct: [
          { expression: { symbol: "x" } }
          { expression: { symbol: "y" } }
        ]
      )

    it "with names", ->
      parse("(  x=3,y = 4)").should.eql(
        struct: [
          { name: "x", expression: { number: "base10", value: "3" } }
          { name: "y", expression: { number: "base10", value: "4" } }
        ]
      )

    it "single-valued", ->
      parse("(true)").should.eql(boolean: true)

  it "unary", ->
    parse("not true").should.eql(unary: "not", right: { boolean: true })
    parse("-  5").should.eql(unary: "-", right: { number: "base10", value: "5" })
    parse("+a").should.eql(unary: "+", right: { symbol: "a" })

  describe "call", ->
    it "simple", ->
      parse("a b").should.eql(call: { symbol: "a" }, arg: { symbol: "b" })
      parse("3 :+").should.eql(
        call: { number: "base10", value: "3" }
        arg: { symbol: "+" }
      )

    it "compound", ->
      parse("widget draw()").should.eql(
        call:
          call: { symbol: "widget" }
          arg: { symbol: "draw" }
        arg: { nothing: true }
      )
      parse("widget height subtract 3").should.eql(
        call:
          call:
            call: { symbol: "widget" }
            arg: { symbol: "height" }
          arg: { symbol: "subtract" }
        arg: { number: "base10", value: "3" }
      )

    it "with struct", ->
      parse("b add(4, 5)").should.eql(
        call:
          call: { symbol: "b" }
          arg: { symbol: "add" }
        arg:
          struct: [
            { expression: { number: "base10", value: "4" } }
            { expression: { number: "base10", value: "5" } }
          ]
      )

    it "multi-line", ->
      parse("a b \\\n  c").should.eql(
        call:
          call: { symbol: "a" }
          arg: { symbol: "b" }
        arg: { symbol: "c" }
      )

  describe "binary", ->
    it "**", ->
      parse("2 ** 3 ** 4").should.eql(
        binary: "**"
        left:
          binary: "**"
          left: { number: "base10", value: "2" }
          right: { number: "base10", value: "3" }
        right: { number: "base10", value: "4" }
      )

    it "* / %", ->
      parse("a * b / c % d").should.eql(
        binary: "%"
        left:
          binary: "/"
          left:
            binary: "*"
            left: { symbol: "a" }
            right: { symbol: "b" }
          right: { symbol: "c" }
        right: { symbol: "d" }
      )

    it "+ -", ->
      parse("a + b - c").should.eql(
        binary: "-"
        left:
          binary: "+"
          left: { symbol: "a" }
          right: { symbol: "b" }
        right: { symbol: "c" }
      )

    it "* vs + precedence", ->
      parse("a + b * c + d").should.eql(
        binary: "+"
        left:
          binary: "+"
          left: { symbol: "a" }
          right:
            binary: "*"
            left: { symbol: "b" }
            right: { symbol: "c" }
        right: { symbol: "d" }
      )

    it "+ == and precedence", ->
      parse("a and b + c == d").should.eql(
        binary: "and"
        left: { symbol: "a" }
        right:
          binary: "=="
          left:
            binary: "+"
            left: { symbol: "b" }
            right: { symbol: "c" }
          right: { symbol: "d" }
      )
      
    it "can span multiple lines", ->
      parse("3 + \\\n 4").should.eql(
        binary: "+"
        left: { number: "base10", value: "3" }
        right: { number: "base10", value: "4" }
      )








