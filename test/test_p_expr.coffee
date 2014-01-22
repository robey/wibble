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

  it "reference", ->
    parse("x").should.eql(reference: "x", pos: [ 0, 1 ])
    parse("hello").should.eql(reference: "hello", pos: [ 0, 5 ])

  describe "array", ->
    it "empty", ->
      parse("[]").should.eql(array: [], pos: [ 0, 2 ])
      parse("[  ]").should.eql(array: [], pos: [ 0, 4 ])

    it "single", ->
      parse("[ 3 ]").should.eql(array: [ { number: "base10", value: "3", pos: [ 2, 3 ] } ], pos: [ 0, 5 ])

    it "multiple", ->
      parse("[ true, true, false ]").should.eql(array: [
        { boolean: true, pos: [ 2, 6 ] }
        { boolean: true, pos: [ 8, 12 ] }
        { boolean: false, pos: [ 14, 19 ] }
      ], pos: [ 0, 21 ])

    it "trailing comma", ->
      parse("[9,]").should.eql(array: [ { number: "base10", value: "9", pos: [ 1, 2 ] } ], pos: [ 0, 4 ])

    it "nested", ->
      parse("[ [true], [false] ]").should.eql(array: [
        { array: [ { boolean: true, pos: [ 3, 7 ] } ], pos: [ 2, 8 ] }
        { array: [ { boolean: false, pos: [ 11, 16 ] } ], pos: [ 10, 17 ] }
      ], pos: [ 0, 19 ])

    it "multi-line", ->
      parse("[\n  true\n  false\n]").should.eql(array: [ { boolean: true, pos: [ 4, 8 ] }, { boolean: false, pos: [ 11, 16 ] } ], pos: [ 0, 18 ])

    it "failing", ->
      parseFailed("[ ??? ]").should.match(/Expected array/)

  describe "struct", ->
    it "without names", ->
      parse("(x, y)").should.eql(
        struct: [
          { expression: { reference: "x", pos: [ 1, 2 ] }, pos: [ 1, 2 ] }
          { expression: { reference: "y", pos: [ 4, 5 ] }, pos: [ 4, 5 ] }
        ]
        pos: [ 0, 6 ]
      )

    it "with names", ->
      parse("(  x=3,y = 4)").should.eql(
        struct: [
          { name: "x", expression: { number: "base10", value: "3", pos: [ 5, 6 ] }, pos: [ 3, 6 ] }
          { name: "y", expression: { number: "base10", value: "4", pos: [ 11, 12 ] }, pos: [ 7, 12 ] }
        ]
        pos: [ 0, 13 ]
      )

    it "single-valued", ->
      parse("(true)").should.eql(boolean: true, pos: [ 1, 5 ])

    it "failing", ->
      parseFailed("(???)").should.match(/Expected expression/)
      parseFailed("(x = ???)").should.match(/Expected expression/)

  it "unary", ->
    parse("not true").should.eql(unary: "not", right: { boolean: true, pos: [ 4, 8 ] }, pos: [ 0, 8 ])
    parse("-  5").should.eql(unary: "-", right: { number: "base10", value: "5", pos: [ 3, 4 ] }, pos: [ 0, 4 ])
    parse("+a").should.eql(unary: "+", right: { reference: "a", pos: [ 1, 2 ] }, pos: [ 0, 2 ])

  describe "call", ->
    it "simple", ->
      parse("a b").should.eql(
        call: { reference: "a", pos: [ 0, 1 ] }
        arg: { reference: "b", pos: [ 2, 3 ] }
        pos: [ 0, 3 ]
      )
      parse("3 .+").should.eql(
        call: { number: "base10", value: "3", pos: [ 0, 1 ] }
        arg: { symbol: "+", pos: [ 2, 4 ] }
        pos: [ 0, 4 ]
      )

    it "compound", ->
      parse("widget.draw()").should.eql(
        call:
          call: { reference: "widget", pos: [ 0, 6 ] }
          arg: { symbol: "draw", pos: [ 6, 11 ] }
          pos: [ 0, 11 ]
        arg: { nothing: true, pos: [ 11, 13 ] }
        pos: [ 0, 13 ]
      )
      parse("widget .height .subtract 3").should.eql(
        call:
          call:
            call: { reference: "widget", pos: [ 0, 6 ] }
            arg: { symbol: "height", pos: [ 7, 14 ] }
            pos: [ 0, 14 ]
          arg: { symbol: "subtract", pos: [ 15, 24 ] }
          pos: [ 0, 24 ]
        arg: { number: "base10", value: "3", pos: [ 25, 26 ] }
        pos: [ 0, 26 ]
      )

    it "with struct", ->
      parse("b.add(4, 5)").should.eql(
        call:
          call: { reference: "b", pos: [ 0, 1 ] }
          arg: { symbol: "add", pos: [ 1, 5 ] }
          pos: [ 0, 5 ]
        arg:
          struct: [
            { expression: { number: "base10", value: "4", pos: [ 6, 7 ] }, pos: [ 6, 7 ] }
            { expression: { number: "base10", value: "5", pos: [ 9, 10 ] }, pos: [ 9, 10 ] }
          ]
          pos: [ 5, 11 ]
        pos: [ 0, 11 ]
      )

    it "multi-line", ->
      parse("a .b \\\n  .c").should.eql(
        call:
          call: { reference: "a", pos: [ 0, 1 ] }
          arg: { symbol: "b", pos: [ 2, 4 ] }
          pos: [ 0, 4 ]
        arg: { symbol: "c", pos: [ 9, 11 ] }
        pos: [ 0, 11 ]
      )

  describe "binary", ->
    it "**", ->
      parse("2 ** 3 ** 4").should.eql(
        binary: "**"
        left:
          binary: "**"
          left: { number: "base10", value: "2", pos: [ 0, 1 ] }
          right: { number: "base10", value: "3", pos: [ 5, 6 ] }
          pos: [ 0, 6 ]
        right: { number: "base10", value: "4", pos: [ 10, 11 ] }
        pos: [ 0, 11 ]
      )

    it "* / %", ->
      parse("a * b / c % d").should.eql(
        binary: "%"
        left:
          binary: "/"
          left:
            binary: "*"
            left: { reference: "a", pos: [ 0, 1 ] }
            right: { reference: "b", pos: [ 4, 5 ] }
            pos: [ 0, 5 ]
          right: { reference: "c", pos: [ 8, 9 ] }
          pos: [ 0, 9 ]
        right: { reference: "d", pos: [ 12, 13 ] }
        pos: [ 0, 13 ]
      )

    it "+ -", ->
      parse("a + b - c").should.eql(
        binary: "-"
        left:
          binary: "+"
          left: { reference: "a", pos: [ 0, 1 ] }
          right: { reference: "b", pos: [ 4, 5 ] }
          pos: [ 0, 5 ]
        right: { reference: "c", pos: [ 8, 9 ] }
        pos: [ 0, 9 ]
      )

    it "* vs + precedence", ->
      parse("a + b * c + d").should.eql(
        binary: "+"
        left:
          binary: "+"
          left: { reference: "a", pos: [ 0, 1 ] }
          right:
            binary: "*"
            left: { reference: "b", pos: [ 4, 5 ] }
            right: { reference: "c", pos: [ 8, 9 ] }
            pos: [ 4, 9 ]
          pos: [ 0, 9 ]
        right: { reference: "d", pos: [ 12, 13 ] }
        pos: [ 0, 13 ]
      )

    it "+, ==, and precedence", ->
      parse("a and b + c == d").should.eql(
        binary: "and"
        left: { reference: "a", pos: [ 0, 1 ] }
        right:
          binary: "=="
          left:
            binary: "+"
            left: { reference: "b", pos: [ 6, 7 ] }
            right: { reference: "c", pos: [ 10, 11 ] }
            pos: [ 6, 11 ]
          right: { reference: "d", pos: [ 15, 16 ] }
          pos: [ 6, 16 ]
        pos: [ 0, 16 ]
      )

    it "can span multiple lines", ->
      parse("3 + \\\n 4").should.eql(
        binary: "+"
        left: { number: "base10", value: "3", pos: [ 0, 1 ] }
        right: { number: "base10", value: "4", pos: [ 7, 8 ] }
        pos: [ 0, 8 ]
      )

    it "notices a missing argument", ->
      parseFailed("3 +").should.eql "Expected operand"
      parseFailed("3 + 6 *").should.eql "Expected operand"

  describe "if", ->
    it "if _ then _", ->
      parse("if x < 0 then x").should.eql(
        condition:
          binary: "<"
          left: { reference: "x", pos: [ 3, 4 ] }
          right: { number: "base10", value: "0", pos: [ 7, 8 ] }
          pos: [ 3, 8 ]
        ifThen: { reference: "x", pos: [ 14, 15 ] }
        pos: [ 0, 2 ]
      )

    it "if _ then _ else _", ->
      parse("if x < 0 then -x else x").should.eql(
        condition:
          binary: "<"
          left: { reference: "x", pos: [ 3, 4 ] }
          right: { number: "base10", value: "0", pos: [ 7, 8 ] }
          pos: [ 3, 8 ]
        ifThen:
          unary: "-"
          right: { reference: "x", pos: [ 15, 16 ] }
          pos: [ 14, 16 ]
        ifElse: { reference: "x", pos: [ 22, 23 ] }
        pos: [ 0, 2 ]
      )

    it "if {block} then _ else _", ->
      parse("if { 3; true } then 1 else 2").should.eql(
        condition:
          code: [
            { number: "base10", value: "3", pos: [ 5, 6 ] }
            { boolean: true, pos: [ 8, 12 ] }
          ]
          pos: [ 3, 14 ]
        ifThen: { number: "base10", value: "1", pos: [ 20, 21 ] }
        ifElse: { number: "base10", value: "2", pos: [ 27, 28 ] }
        pos: [ 0, 2 ]
      )

    it "nested", ->
      parse("if a then (if b then 3) else 9").should.eql(
        condition: { reference: "a", pos: [ 3, 4 ] }
        ifThen:
          condition: { reference: "b", pos: [ 14, 15 ] }
          ifThen: { number: "base10", value: "3", pos: [ 21, 22 ] }
          pos: [ 11, 13 ]
        ifElse: { number: "base10", value: "9", pos: [ 29, 30 ] }
        pos: [ 0, 2 ]
      )

    it "failing", ->
      parseFailed("if ???").should.match(/Expected expression/)
      parseFailed("if 3 then ???").should.match(/Expected expression/)
      parseFailed("if 3 then 3 else ???").should.match(/Expected expression/)


