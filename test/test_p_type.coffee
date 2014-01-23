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
    parse("Int").should.eql(typename: "Int", pos: [ 0, 3 ])
    parseFailed("int").should.match(/Expected type/)

  it "compound", ->
    parse("(Int,String)").should.eql(
      compoundType: [
        { typename: "Int", pos: [ 1, 4 ] }
        { typename: "String", pos: [ 5, 11 ] }
      ]
      pos: [ 0, 12 ]
    )
    parse("( Int, String )").should.eql(
      compoundType: [
        { typename: "Int", pos: [ 2, 5 ] }
        { typename: "String", pos: [ 7, 13 ] }
      ]
      pos: [ 0, 15 ]
    )
    parse("(x: Int, y:String)").should.eql(
      compoundType: [
        { name: "x", namedType: { typename: "Int", pos: [ 4, 7 ] }, pos: [ 1, 7 ] }
        { name: "y", namedType: { typename: "String", pos: [ 11, 17 ] }, pos: [ 9, 17 ] }
      ]
      pos: [ 0, 18 ]
    )

  it "function", ->
    parse("Long -> Int").should.eql(
      functionType: { typename: "Int", pos: [ 8, 11 ] }
      argType: { typename: "Long", pos: [ 0, 4 ] }
      pos: [ 0, 11 ]
    )

  it "template", ->
    parse("List(Int)").should.eql(
      templateType: "List"
      parameters: [
        { typename: "Int", pos: [ 5, 8 ] }
      ]
      pos: [ 0, 9 ]
    )
    parse("Map(String, Int)").should.eql(
      templateType: "Map"
      parameters: [
        { typename: "String", pos: [ 4, 10 ] }
        { typename: "Int", pos: [ 12, 15 ] }
      ]
      pos: [ 0, 16 ]
    )

  it "combined", ->
    parse("Map(String, List(Int -> (real: Float, imaginary: Float)))").should.eql(
      templateType: "Map"
      parameters: [
        { typename: "String", pos: [ 4, 10 ] }
        {
          templateType: "List"
          parameters: [
            { 
              functionType: {
                compoundType: [
                  { name: "real", namedType: { typename: "Float", pos: [ 31, 36 ] }, pos: [ 25, 36 ] }
                  { name: "imaginary", namedType: { typename: "Float", pos: [ 49, 54 ] }, pos: [ 38, 54 ] }
                ]
                pos: [ 24, 55 ]
              }
              argType: { typename: "Int", pos: [ 17, 20 ] }
              pos: [ 17, 55 ]
            }
          ]
          pos: [ 12, 56 ]
        }
      ]
      pos: [ 0, 57 ]
    )
