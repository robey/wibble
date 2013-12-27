inspect = require('util').inspect
should = require 'should'

transform = require('../src/wibble').transform

describe "Transform", ->
  return
  it "binary operations into calls", ->
    expr =
      binary: "**"
      left: { reference: "x" }
      right: { reference: "y" }
    transform(expr).should.eql(
      call:
        call: { reference: "x" }
        arg: { symbol: "**" }
      arg: { reference: "y" }
    )

  it "binary operations into calls even when deeply nested", ->
    expr =
      params: [
        { name: "x", type: "Int", value: undefined }
      ]
      func:
        code: [
          { binary: "+", left: { reference: "x" }, right: { reference: "y" } }
        ]
    transform(expr).should.eql(
      params: [
        { name: "x", type: "Int", value: undefined }
      ]
      func:
        code: [
          {
            call:
              call: { reference: "x" }
              arg: { symbol: "+" }
            arg: { reference: "y" }
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
        left: { reference: "x" }
        right: { reference: "x" }
    transform(expr).should.eql(
      local: "square"
      value:
        params: [
          { name: "x", type: "Int", value: undefined }
        ]
        func:
          call:
            call: { reference: "x" }
            arg: { symbol: "*" }
          arg: { reference: "x" }
    )

#  it "handlers into contexts", ->
#    expr =
#      code: [
#        { symbol: "x" }
#        { on: { symbol: "destroy" }, handler: { symbol: "ok" } }
#      ]
#    transform(expr).should.eql(
#      context: [
#        { symbol: "x" }
#      ]
#      handlers: [
#        { on: { symbol: "destroy" }, handler: { symbol: "ok" } }
#      ]
#    )
