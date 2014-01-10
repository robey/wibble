should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_code = require "#{wibble}/parser/p_code"
p_expr = require "#{wibble}/parser/p_expr"
test_util = require './test_util'

parseWith = test_util.parseWith
parseFailedWith = test_util.parseFailedWith

describe "Parse code", ->
  describe "function", ->
    parse = (line, options) -> parseWith(p_code.functionx, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_code.functionx, line, options)

    it "empty", ->
      parse("-> ()").should.eql(
        parameters: [],
        functionx: { nothing: true, pos: [ 3, 5 ] }
        pos: [ 0, 5 ]
      )

    it "simple expression", ->
      parse("(x: Int) -> x * 2").should.eql(
        parameters: [
          { name: "x", type: { type: "Int" }, value: undefined, pos: [ 1, 2 ] }
        ]
        functionx:
          binary: "*"
          left: { reference: "x", pos: [ 12, 13 ] }
          right: { number: "base10", value: "2", pos: [ 16, 17 ] }
          pos: [ 12, 17 ]
        pos: [ 0, 17 ]
      )

    it "complex parameters", ->
      parse("(a: Map(String, Int), b: String -> Int) -> false").should.eql(
        parameters: [
          {
            name: "a"
            type:
              templateType: "Map"
              parameters: [
                { type: "String" },
                { type: "Int" }
              ]
            value: undefined
            pos: [ 1, 2 ]
          },
          {
            name: "b"
            type:
              functionType: { type: "Int" }
              argType: { type: "String" }
            value: undefined
            pos: [ 22, 23 ]
          }
        ]
        functionx: { boolean: false, pos: [ 43, 48 ] }
        pos: [ 0, 48 ]
      )

    it "default values", ->
      parse("(x: Int = 4, y: Int = 5) -> x + y").should.eql(
        parameters: [
          { name: "x", type: { type: "Int" }, value: { number: "base10", value: "4", pos: [ 10, 11 ] }, pos: [ 1, 2 ] }
          { name: "y", type: { type: "Int" }, value: { number: "base10", value: "5", pos: [ 22, 23 ] }, pos: [ 13, 14 ] }
        ]
        functionx:
          binary: "+"
          left: { reference: "x", pos: [ 28, 29 ] }
          right: { reference: "y", pos: [ 32, 33 ] }
          pos: [ 28, 33 ]
        pos: [ 0, 33 ]
      )

    it "nested", ->
      parse("-> -> 69").should.eql(
        parameters: []
        functionx:
          parameters: []
          functionx: { number: "base10", value: "69", pos: [ 6, 8 ] }
          pos: [ 2, 8 ]
        pos: [ 0, 8 ]
      )

    it "via expression", ->
      parse = (line, options) -> parseWith(p_expr.expression, line, options)
      parse("-> 3").should.eql(parameters: [], functionx: { number: "base10", value: "3", pos: [ 3, 4 ] }, pos: [ 0, 4 ])
      parse("(x: Int) -> 3").should.eql(
        parameters: [
          { name: "x", type: { type: "Int" }, value: undefined, pos: [ 1, 2 ] }
        ]
        functionx: { number: "base10", value: "3", pos: [ 12, 13 ] }
        pos: [ 0, 13 ]
      )

  describe "code", ->
    parse = (line, options) -> parseWith(p_code.code, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_code.code, line, options)

    it "expression", ->
      parse("x + y").should.eql(
        binary: "+"
        left: { reference: "x", pos: [ 0, 1 ] }
        right: { reference: "y", pos: [ 4, 5 ] }
        pos: [ 0, 5 ]
      )

    it "local val", ->
      parse("val x = 100").should.eql(
        local: "x"
        value: { number: "base10", value: "100", pos: [ 8, 11 ] }
        pos: [ 0, 11 ]
      )

  describe "block of code", ->
    parse = (line, options) -> parseWith(p_code.codeBlock, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_code.codeBlock, line, options)

    it "empty", ->
      parse("{}").should.eql(code: [], pos: [ 0, 2 ])
      parse("{  }").should.eql(code: [], pos: [ 0, 4 ])

    it "separated by ;", ->
      parse("{ 3; 4 }").should.eql(
        code: [
          { number: "base10", value: "3", pos: [ 2, 3 ] }
          { number: "base10", value: "4", pos: [ 5, 6 ] }
        ]
        pos: [ 0, 8 ]
      )

    it "separated by linefeed", ->
      parse("{\n  true\n  false\n}").should.eql(
        code: [
          { boolean: true, pos: [ 4, 8 ] }
          { boolean: false, pos: [ 11, 16 ] }
        ]
        pos: [ 0, 18 ]
      )
