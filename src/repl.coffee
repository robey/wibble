packrattle = require 'packrattle'
path = require 'path'
util = require 'util'

wibble = require './wibble'
package_json = require '../package.json'
build_date = require './build_date'

env =
  debugParse: false
  debugCompile: false
  debugEval: false
  debugParseDot: false
  maxHistory: 100
  timeLimit: 15
  historyFilename: path.join(process.env["HOME"] or process.env["USERPROFILE"] or ".", ".wibble_history")

class Repl
  constructor: (@terminal) ->
    if not @terminal?
      unix_terminal = require './unix_terminal'
      @terminal = new unix_terminal.UnixTerminal(env.historyFilename, env.maxHistory)
    @globalScope = new wibble.transform.Scope()
    @globals = new wibble.runtime.Namespace()

  run: ->
    @terminal.printColor("0c0", "wibble")
    @terminal.printColor("080", " ¤")
    @terminal.println(" jsrepl v#{package_json.version}.#{build_date.build_date}")
    @terminal.println("(c) 2014-2019 Regents of Teeth-gnashing Despair")
    @terminal.print("Use ")
    @terminal.printColor("0c0", "/help")
    @terminal.println(" for help with meta-commands.")
    @terminal.println()

    @terminal.readline "e0c", "| ", ": ", (line) =>
      if not line?
        @terminal.println()
        @terminal.println()
        @terminal.printlnColor("44f", "Goodbye!")
        @terminal.println()
        @terminal.exit(0)
      if line[0] == "/" then return @command(line[1...])
      if line == "" then return true

      # parse
      try
        expr = @parseWibble(line)
      catch e
        if wibble.parser.couldContinue(line, e.state) then return false
        @displayError(e)
        return true

      buffer = ""
      if env.debugParse
        @terminal.printColor("ff0", "  ; ")
        @terminal.println(wibble.dumpExpr(expr))

      # transform (compile) / typecheck
      t_logger = (s) =>
        if env.debugCompile
          @terminal.printColor("f80", "  ; ")
          @terminal.println(s)
      try
        expr = wibble.transform.transformExpr(expr)
        [ expr, type ] = wibble.transform.typecheck(@globalScope, expr, allowOverride: true, logger: t_logger)
      catch e
        if e.state?
          @displayError(e)
        else
          # internal compiler error
          @terminal.printColor("f00", e.toString() + "\n")
          @terminal.println e.stack
        return true

      if env.debugCompile
        @terminal.printColor("f80", "  ; ")
        @terminal.printColor("66f", "#{type.inspect()}: ")
        @terminal.println(wibble.dumpExpr(expr))

      # eval
      try
        logger = (line) =>
          if env.debugEval
            @terminal.printColor("a00", "  ; ")
            @terminal.println(line)
        deadline = Date.now() + env.timeLimit * 1000
        rstate = new wibble.runtime.RuntimeState(locals: @globals, logger: logger, deadline: deadline)
        rv = wibble.runtime.evalExpr(expr, rstate)
        @terminal.printColor("99f", wibble.runtime.inspect(rv, rstate))
        @terminal.printColor("66f", ": #{rv.type.inspect()}")
        @terminal.println()
      catch e
        if e.state?
          @displayError(e)
        else
          # internal compiler error
          @terminal.printColor("f00", e.toString() + "\n")
          @terminal.println e.stack

      true

  parseWibble: (line) ->
    ast = wibble.parser.code.run(line, debugGraph: env.debugParseDot)
    if env.debugParseDot
      @terminal.println("* Writing repl.dot")
      try
        fs = require 'fs'
        fs.writeFileSync("repl.dot", ast.state.debugGraphToDot())
      catch e
        @terminal.println(e.stack)
    ast

  displayError: (e) ->
    [ line, squiggles ] = e.state.toSquiggles()
    @terminal.printlnColor("f88", line)
    @terminal.printlnColor("f4f", squiggles)
    @terminal.printColor("f00", "*** ")
    @terminal.println("[#{e.state.lineno() + 1}] #{e.message}")

  command: (line) ->
    # FIXME maybe use packrattle for this ;)
    args = line.split(" ")
    switch args[0]
      when "debug" then @commandDebug(args[1...])
      when "globals" then @commandGlobals()
      when "timeout" then @commandTimeout(args[1])
      else @commandHelp()
    true

  commandHelp: ->
    @terminal.println "Type any wibble expression to have it evaluated."
    @terminal.println "(January edition: only supports integer math.)"
    @terminal.println ""
    @terminal.print "For a quickref of syntax/features: "
    @terminal.printUrl "https://github.com/robey/wibble/blob/master/docs/demo.md"
    @terminal.println ""
    @terminal.println ""
    @terminal.println "Meta-commands:"
    @terminal.println "  /debug [options...]"
    @terminal.println "      turn on/off various debug logging (parse, compile, eval) (or all)"
    @terminal.println "      example: /debug +eval -parse"
    @terminal.println "  /globals"
    @terminal.println "      list names and types of globals"
    @terminal.println "  /timeout <seconds>"
    @terminal.println "      set timeout for long-running evals"

  commandDebug: (options) ->
    for x in options then switch x
      when "+parse" then env.debugParse = true
      when "-parse" then env.debugParse = false
      when "+compile" then env.debugCompile = true
      when "-compile" then env.debugCompile = false
      when "+eval" then env.debugEval = true
      when "-eval" then env.debugEval = false
      when "+dot" then env.debugParseDot = true
      when "-dot" then env.debugParseDot = false
      when "+all"
        env.debugParse = env.debugCompile = env.debugEval = true
      when "-all"
        env.debugParse = env.debugCompile = env.debugEval = false
      else @terminal.println "(Don't understand '#{x}'; ignoring.)"
    @terminal.println [
      if env.debugParse then "+parse" else "-parse"
      if env.debugCompile then "+compile" else "-compile"
      if env.debugEval then "+eval" else "-eval"
      if env.debugParseDot then "+dot" else "-dot"
    ].join(" ")

  commandGlobals: ->
    names = @globals.keys()
    if names.length == 0
      @terminal.println("No globals.")
      return
    for name in names
      @terminal.printColor("99f", name)
      @terminal.printColor("66f", ": #{@globals.get(name).type.inspect()}")
      @terminal.println()

  commandTimeout: (timeout) ->
    if timeout?
      env.timeLimit = parseInt(timeout)
    @terminal.println("Current timeout: #{env.timeLimit} (sec)")


main = (terminal) -> new Repl(terminal).run()


exports.Repl = Repl
exports.main = main
