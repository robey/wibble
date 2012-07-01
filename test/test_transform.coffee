inspect = require('util').inspect
should = require 'should'

transform = require('../src/wibble').transform

describe "Transform", ->
  it "binary operations into calls", ->
    expr =
      binary: "**"
      left: { symbol: "x" }
      right: { symbol: "y" }
    transform(expr).should.eql(
      call:
        call: { symbol: "x" }
        arg: { symbol: "**" }
      arg: { symbol: "y" }
    )

  it "binary operations into calls even when deeply nested", ->
    expr =
      params: [
        { name: "x", type: "Int", value: undefined }
      ]
      func:
        code: [
          { binary: "+", left: { symbol: "x" }, right: { symbol: "y" } }
        ]
    transform(expr).should.eql(
      params: [
        { name: "x", type: "Int", value: undefined }
      ]
      func:
        code: [
          {
            call:
              call: { symbol: "x" }
              arg: { symbol: "+" }
            arg: { symbol: "y" }
          }
        ]
    )
