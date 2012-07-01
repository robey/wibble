inspect = require('util').inspect
should = require 'should'

parser = require('../src/wibble').parser

describe "Parse", ->
  describe "an expression of", ->
    parse = (line) -> parser.expression.consume(line).match

    it "symbol", ->
      parse("hello").should.eql(symbol: "hello")
      parse("_").should.eql(symbol: "_")
      parse("A3").should.eql(symbol: "A3")

    it "number", ->
      parse("23").should.eql(number: "int", value: "23")
      parse("0").should.eql(number: "int", value: "0")
      parse("-919").should.eql(number: "int", value: "-919")
      parse("1.2").should.eql(number: "real", value: "1.2")
      parse("-500.2L").should.eql(number: "long-real", value: "-500.2")
      parse("12345L").should.eql(number: "long-int", value: "12345")

    it "boolean", ->
      parse("true").should.eql(boolean: true)
      parse("false").should.eql(boolean: false)

    it "unit", ->
      parse("()").should.eql(unit: true)

    it "opref", ->
      parse(":*").should.eql(symbol: "*")

    it "struct", ->
      parse("(x, y)").should.eql(
        struct: [
          { expression: { symbol: "x" } }
          { expression: { symbol: "y" } }
        ]
      )
      parse("(x=3, y = 4)").should.eql(
        struct: [
          { name: "x", expression: { number: "int", value: "3" } }
          { name: "y", expression: { number: "int", value: "4" } }
        ]
      )

    it "call", ->
      parse("a b").should.eql(call: { symbol: "a" }, arg: { symbol: "b" })
      parse("widget draw()").should.eql(
        call:
          call: { symbol: "widget" }
          arg: { symbol: "draw" }
        arg: { unit: true }
      )
      parse("widget height subtract 3").should.eql(
        call:
          call:
            call: { symbol: "widget" }
            arg: { symbol: "height" }
          arg: { symbol: "subtract" }
        arg: { number: "int", value: "3" }
      )
      parse("3 :+").should.eql(
        call: { number: "int", value: "3" }
        arg: { symbol: "+" }
      )

    it "call with struct", ->
      parse("b add(4, 5)").should.eql(
        call:
          call: { symbol: "b" }
          arg: { symbol: "add" }
        arg:
          struct: [
            { expression: { number: "int", value: "4" } }
            { expression: { number: "int", value: "5" } }
          ]
      )

    it "**", ->
      parse("2 ** 3 ** 4").should.eql(
        binary: "**"
        left:
          binary: "**"
          left: { number: "int", value: "2" }
          right: { number: "int", value: "3" }
        right: { number: "int", value: "4" }
      )

    it "* /", ->
      parse("a * b / c").should.eql(
        binary: "/"
        left:
          binary: "*"
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

    it "can span multiple lines", ->
      parse("3 + \\\n 4").should.eql(
        binary: "+"
        left: { number: "int", value: "3" }
        right: { number: "int", value: "4" }
      )

    it "if", ->
      parse("if x < 0 then x").should.eql(
        condition:
          binary: "<"
          left: { symbol: "x" }
          right: { number: "int", value: "0" }
        ifThen: { symbol: "x" }
      )
      parse("if x < 0 then -x else x").should.eql(
        condition:
          binary: "<"
          left: { symbol: "x" }
          right: { number: "int", value: "0" }
        ifThen:
          unary: "negate"
          right: { symbol: "x" }
        ifElse: { symbol: "x" }
      )
      parse("if { 3; true } then 1 else 2").should.eql(
        condition:
          code: [
            { number: "int", value: "3" }
            { boolean: true }
          ]
        ifThen: { number: "int", value: "1" }
        ifElse: { number: "int", value: "2" }
      )

    it "an anonymous function in block", ->
      parse("(x: Int, y: Int) -> { x * x + y * y }").should.eql(
        params: [
          { name: "x", type: "Int", value: undefined }
          { name: "y", type: "Int", value: undefined }
        ]
        func:
          code: [
            {
              binary: "+"
              left:
                binary: "*"
                left: { symbol: "x" }
                right: { symbol: "x" }
              right:
                binary: "*"
                left: { symbol: "y" }
                right: { symbol: "y" }
            }
          ]
      )

      parse("(x: Int = 4, y: Int = 5) -> { x }").should.eql(
        params: [
          { name: "x", type: "Int", value: { number: "int", value: "4" } }
          { name: "y", type: "Int", value: { number: "int", value: "5" } }
        ]
        func:
          code: [ { symbol: "x" } ]
      )

    it "an anonymous function in an expression", ->
      parse("(x: Int) -> x * 2").should.eql(
        params: [
          { name: "x", type: "Int", value: undefined }
        ]
        func:
          binary: "*"
          left: { symbol: "x" }
          right: { number: "int", value: "2" }
      )

    it "an anonymous function that's immediately called", ->
      parse("{ 3 } ()").should.eql(
        call:
          code: [
            { number: "int", value: "3" }
          ]
        arg: { unit: true }
      )
      parse("(-> 3) ()").should.eql(
        call:
          params: []
          func: { number: "int", value: "3" }
        arg: { unit: true }
      )

  describe "a method of", ->
    parse = (line) -> parser.method.consume(line).match

    it "empty", ->
      parse("def nothing() = ()").should.eql(
        method:
          symbol: "nothing"
        params: []
        body:
          { unit: true }
      )

    it "parameters", ->
      parse("def absorb(x: Int, y: Int) = {}").should.eql(
        method:
          symbol: "absorb"
        params: [
          { name: "x", type: "Int", value: undefined }
          { name: "y", type: "Int", value: undefined }
        ]
        body:
          code: []
      )

    it "code", ->
      parse("def square(x: Int) = { widget draw(); x ** 2 }").should.eql(
        method:
          symbol: "square"
        params: [
          { name: "x", type: "Int", value: undefined }
        ]
        body:
          code: [
            { 
              call:
                call: { symbol: "widget" }
                arg: { symbol: "draw" }
              arg: { unit: true }
            }
            { 
              binary: "**"
              left: { symbol: "x" }
              right: { number: "int", value: "2" }
            }
          ]
      )

    it "one line", ->
      parse("def pi() = 3").should.eql(
        method: { symbol: "pi" }
        params: []
        body: { number: "int", value: "3" }
      )

    it "operator reference", ->
      parse("def :+(_: Int) = _ + 1").should.eql(
        method: { symbol: "+" }
        params: [
          { name: "_", type: "Int", value: undefined }
        ]
        body:
          binary: "+"
          left: { symbol: "_" }
          right: { number: "int", value: "1" }
      )

    it "code with val", ->
      parse("def square(x: Int) = {\n  val n = x * x\n  n\n}").should.eql(
        method: { symbol: "square" }
        params: [
          { name: "x", type: "Int", value: undefined }
        ]
        body:
          code: [
            {
              local: "n"
              value:
                binary: "*"
                left: { symbol: "x" }
                right: { symbol: "x" }
            }
            { symbol: "n" }
          ]
      )
