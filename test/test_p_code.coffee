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
          left: { symbol: "x" }
          right: { number: "base10", value: "2" }
      )

    it "complex type", ->
      console.log util.inspect(parse("(a: Map(String, Int), b: String -> Int) -> false"), depth: null)
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
