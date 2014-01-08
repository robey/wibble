inspect = require('util').inspect
should = require 'should'

parser = require('../src/wibble').parser

describe "Parse", ->
  return
  describe "an expression of", ->
    parse = (line) -> parser.expression.consume(line).match







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
    parse = (line) -> parser.blockCode.consume(line).match

    it "empty", ->
      parse("def nothing() = ()").should.eql(
        method: "nothing"
        params: []
        body:
          { unit: true }
      )

    it "parameters", ->
      parse("def absorb(x: Int, y: Int) = {}").should.eql(
        method: "absorb"
        params: [
          { name: "x", type: "Int", value: undefined }
          { name: "y", type: "Int", value: undefined }
        ]
        body:
          code: []
      )

    it "code", ->
      parse("def square(x: Int) = { widget draw(); x ** 2 }").should.eql(
        method: "square"
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
        method: "pi"
        params: []
        body: { number: "int", value: "3" }
      )

    it "operator reference", ->
      parse("def :+(_: Int) = _ + 1").should.eql(
        method: "+"
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
        method: "square"
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

  # describe "a prototype with", ->
  #   parse = (line) -> parser.proto.consume(line).match

  #   it "a message handler", ->
  #     parse("prototype Lame { on 3 -> 4 }").should.eql(
  #       proto: "Lame"
  #       params: []
  #       body: [
  #         on: { number: "int", value: "3" }
  #         handler: { number: "int", value: "4" }
  #       ]
  #     )

  #   it "a message handler for a struct", ->
  #     parse("prototype A {\n  on (x: Int, y: Int) -> { x * y }\n}").should.eql(
  #       proto: "A"
  #       params: []
  #       body: [
  #         on:
  #           params: [
  #             { name: "x", type: "Int", value: undefined }
  #             { name: "y", type: "Int", value: undefined }
  #           ]
  #         handler:
  #           code: [
  #             { binary: "*", left: { symbol: "x" }, right: { symbol: "y" } }
  #           ]
  #       ]
  #     )

  #   it "parameters", ->
  #     parse("prototype Toaster(heat: Int) { 3 }").should.eql(
  #       proto: "Toaster"
  #       params: [
  #         { local: "", name: "heat", type: "Int", value: undefined }
  #       ]
  #       body: [
  #         { number: "int", value: "3" }
  #       ]
  #     )
  #     parse("prototype Toaster(@heat: Int) { 3 }").should.eql(
  #       proto: "Toaster"
  #       params: [
  #         { local: "@", name: "heat", type: "Int", value: undefined }
  #       ]
  #       body: [
  #         { number: "int", value: "3" }
  #       ]
  #     )
