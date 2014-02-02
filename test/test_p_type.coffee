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
    parse("(n:Int,s:String)").should.eql(
      compoundType: [
        { name: "n", type: { typename: "Int", pos: [ 3, 6 ] }, value: undefined, pos: [ 1, 2 ] }
        { name: "s", type: { typename: "String", pos: [ 9, 15 ] }, value: undefined, pos: [ 7, 8 ] }
      ]
      pos: [ 0, 16 ]
    )
    parse("( n: Int, s: String )").should.eql(
      compoundType: [
        { name: "n", type: { typename: "Int", pos: [ 5, 8 ] }, value: undefined, pos: [ 2, 3 ] }
        { name: "s", type: { typename: "String", pos: [ 13, 19 ] }, value: undefined, pos: [ 10, 11 ] }
      ]
      pos: [ 0, 21 ]
    )
    parse("(x: Int, y:String)").should.eql(
      compoundType: [
        { name: "x", type: { typename: "Int", pos: [ 4, 7 ] }, value: undefined, pos: [ 1, 2 ] }
        { name: "y", type: { typename: "String", pos: [ 11, 17 ] }, value: undefined, pos: [ 9, 10 ] }
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
                  { name: "real", type: { typename: "Float", pos: [ 31, 36 ] }, value: undefined, pos: [ 25, 29 ] }
                  { name: "imaginary", type: { typename: "Float", pos: [ 49, 54 ] }, value: undefined, pos: [ 38, 47 ] }
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

  it "divergent", ->
    parse("Int | Symbol").should.eql(
      divergentType: [
        { typename: "Int", pos: [ 0, 3 ] }
        { typename: "Symbol", pos: [ 6, 12 ] }
      ]
      pos: [ 0, 12 ]
    )
    parse("(Int -> Int) | (Symbol -> Int)").should.eql(
      divergentType: [
        {
          functionType: { typename: "Int", pos: [ 8, 11 ] }
          argType: { typename: "Int", pos: [ 1, 4 ] }
          pos: [ 1, 11 ]
        },
        {
          functionType: { typename: "Int", pos: [ 26, 29 ] }
          argType: { typename: "Symbol", pos: [ 16, 22 ] }
          pos: [ 16, 29 ]
        }
      ]
      pos: [ 0, 30 ]
    )