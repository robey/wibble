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
      parse("-> ()").should.eql(parameters: [], functionx: { nothing: true })

    it "simple expression", ->
      parse("(x: Int) -> x * 2").should.eql(
        parameters: [
          { name: "x", type: { type: "Int" }, value: undefined }
        ]
        functionx:
          binary: "*"
          left: { reference: "x" }
          right: { number: "base10", value: "2" }
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
          },
          {
            name: "b"
            type:
              functionType: { type: "Int" }
              argType: { type: "String" }
            value: undefined
          }
        ]
        functionx: { boolean: false }
      )

    it "default values", ->
      parse("(x: Int = 4, y: Int = 5) -> x + y").should.eql(
        parameters: [
          { name: "x", type: { type: "Int" }, value: { number: "base10", value: "4" } }
          { name: "y", type: { type: "Int" }, value: { number: "base10", value: "5" } }
        ]
        functionx:
          binary: "+"
          left: { reference: "x" }
          right: { reference: "y" }
      )

    it "via expression", ->
      parse = (line, options) -> parseWith(p_expr.expression, line, options)
      parse("-> ()").should.eql(parameters: [], functionx: { nothing: true })

    it "nested", ->
      parse("-> -> 69").should.eql(
        parameters: []
        functionx:
          parameters: []
          functionx: { number: "base10", value: "69" }
      )

  describe "code", ->
    parse = (line, options) -> parseWith(p_code.code, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_code.code, line, options)

    it "expression", ->
      parse("x + y").should.eql(
        binary: "+"
        left: { reference: "x" }
        right: { reference: "y" }
      )

    it "local val", ->
      parse("val x = 100").should.eql(
        local: "x"
        value: { number: "base10", value: "100" }
      )

  describe "block of code", ->
    parse = (line, options) -> parseWith(p_code.codeBlock, line, options)
    parseFailed = (line, options) -> parseFailedWith(p_code.codeBlock, line, options)

    it "empty", ->
      parse("{}").should.eql(code: [])
      parse("{  }").should.eql(code: [])

    it "separated by ;", ->
      parse("{ 3; 4 }").should.eql(
        code: [
          { number: "base10", value: "3" }
          { number: "base10", value: "4" }
        ]
      )

    it "separated by linefeed", ->
      parse("{\n  true\n  false\n}").should.eql(
        code: [
          { boolean: true }
          { boolean: false }
        ]
      )
