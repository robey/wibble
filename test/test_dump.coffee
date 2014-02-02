should = require 'should'
util = require 'util'

wibble = "../lib/wibble"
dump = require "#{wibble}/dump"
parser = require "#{wibble}/parser"
test_util = require './test_util'

describe "Dump expressions", ->
  parse = (line, options) -> test_util.parseWith(parser.expression, line, options)

  it "dump strings", ->
    dump.dumpExpr(parse("\"abc\\u000adef\"")).should.eql("\"abc\\ndef\"")
    dump.dumpExpr(parse("\"wut\\u0123\\\"\"")).should.eql("\"wut\\u0123\\\"\"")

  it "dump functions", ->
    dump.dumpExpr(parse("-> 3")).should.eql("() -> 3")
    dump.dumpExpr(parse("(x: Int, y: Int) -> x * y")).should.eql("(x: Int, y: Int) -> x * y")
    dump.dumpExpr(parse("(a: Boolean = false) -> true")).should.eql("(a: Boolean = false) -> true")
    dump.dumpExpr(parse("(x: (names: List(String), title: String)) -> true")).should.eql("(x: (names: List(String), title: String)) -> true")

  it "dump locals", ->
    dump.dumpExpr(parse("{ val x = 9 + a }")).should.eql("{ val x = 9 + a }")

  it "dump handlers", ->
    dump.dumpExpr(parse("{ on .start -> true }")).should.eql("{ on .start -> true }")
    dump.dumpExpr(parse("{ on (x: Int) -> { 16 } }")).should.eql("{ on (x: Int) -> { 16 } }")

describe "Dump types", ->
  parse = (line, options) -> test_util.parseWith(parser.typedecl, line, options)

  it "simple", ->
    dump.dumpType(parse("Int")).should.eql "Int"

  it "compound", ->
    dump.dumpType(parse("(x: Int, y: Int = 9)")).should.eql "(x: Int, y: Int = 9)"

  it "function", ->
    dump.dumpType(parse("String -> Int")).should.eql "String -> Int"

  it "template", ->
    dump.dumpType(parse("List(Int, Int)")).should.eql "List(Int, Int)"

  it "divergent", ->
    dump.dumpType(parse("String | Symbol")).should.eql "String | Symbol"

  it "complex", ->
    dump.dumpType(parse("(Int)")).should.eql "Int"
    dump.dumpType(parse("(Int) | List(Int)")).should.eql "Int | List(Int)"
    dump.dumpType(parse("(Int -> Int) | (String -> String)")).should.eql "(Int -> Int) | (String -> String)"
