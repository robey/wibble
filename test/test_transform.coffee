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

  it "methods into local functions", ->
    expr =
      method: "square"
      params: [
        { name: "x", type: "Int", value: undefined }
      ]
      body:
        binary: "*"
        left: { symbol: "x" }
        right: { symbol: "x" }
    transform(expr).should.eql(
      local: "square"
      value:
        params: [
          { name: "x", type: "Int", value: undefined }
        ]
        func:
          call:
            call: { symbol: "x" }
            arg: { symbol: "*" }
          arg: { symbol: "x" }
    )

  it "handlers into contexts", ->
    expr =
      code: [
        { symbol: "x" }
        { on: { symbol: "destroy" }, handler: { symbol: "ok" } }
      ]
    transform(expr).should.eql(
      context: [
        { symbol: "x" }
      ]
      handlers: [
        { on: { symbol: "destroy" }, handler: { symbol: "ok" } }
      ]
    )
