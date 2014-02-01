inspect = require('util').inspect
should = require 'should'

wibble = require('../src/wibble')

xeval = (line, runtime, scope) ->
  if not scope? then scope = runtime.globals
  rv = wibble.parser.repl.consume(line)
  rv.ok.should.equal(true)
  expr = wibble.transform(rv.match)
  runtime.xeval(expr, scope)

debug = (runtime) ->
  runtime.logger = (stage, message) ->
    console.log stage + ": " + message

describe "Runtime", ->
  return

  # scope check:
  # {
  #   val x = 10
  #   {
  #     val x = 3  
  #     x * 2
  #   } + x
  # }


  it "basic int math", ->
    runtime = new wibble.Runtime()
    xeval("3 + 2", runtime).toDebugType().should.eql([ "Int", "5" ])


  describe "functions", ->
    it "can be created", ->
      runtime = new wibble.Runtime()
      xeval("def square(x: Int) = x * x", runtime)
      xeval("square", runtime).toDebugType()[0].should.eql("((x: Int) -> Int)")

    it "have their own locals", ->
      runtime = new wibble.Runtime()
      scope = new wibble.Scope(runtime.globals)
      runtime.globals.set("x", new wibble.WInt(23))
      xeval("def square(x: Int) = x * x", runtime, scope)
      xeval("square 3", runtime, scope).toDebugType().should.eql([ "Int", "9" ])
      xeval("x", runtime, scope).toDebugType().should.eql([ "Int", "23" ])
