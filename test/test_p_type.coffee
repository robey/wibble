packrattle = require 'packrattle'
should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
p_type = require "#{wibble}/parser/p_type"
test_util = require './test_util'

parseWith = test_util.parseWith
parseFailedWith = test_util.parseFailedWith

INFO = { debugger: { info: console.log } }

describe "Parse types", ->
  parse = (line, options) -> parseWith(p_type.typedecl, line, options)
  parseFailed = (line, options) -> parseFailedWith(p_type.typedecl, line, options)

  it "simple", ->
    parse("Int").should.eql(type: "Int")
    parseFailed("int").should.match(/Expected type/)

  it "compound", ->
    parse("(Int,String)").should.eql(compoundType: [
      { type: "Int" }
      { type: "String" }
    ])
    parse("( Int, String )").should.eql(compoundType: [
      { type: "Int" }
      { type: "String" }
    ])
    parse("(x: Int, y:String)").should.eql(compoundType: [
      { name: "x", namedType: { type: "Int" } }
      { name: "y", namedType: { type: "String" } }
    ])

  it "function", ->
    parse("Long -> Int").should.eql(
      functionType: { type: "Int" }
      argType: { type: "Long" }
    )

  it "template", ->
    parse("List(Int)").should.eql(
      templateType: "List"
      parameters: [
        { type: "Int" }
      ]
    )
    parse("Map(String, Int)").should.eql(
      templateType: "Map"
      parameters: [
        { type: "String" }
        { type: "Int" }
      ]
    )

  it "combined", ->
    parse("Map(String, List(Int -> (real: Float, imaginary: Float)))").should.eql(
      templateType: "Map"
      parameters: [
        { type: "String" }
        { templateType: "List", parameters: [
          { functionType: {
            compoundType: [
              { name: "real", namedType: { type: "Float" } }
              { name: "imaginary", namedType: { type: "Float" } }
            ] }, argType: { type: "Int" }
          }
        ] }
      ]
    )
