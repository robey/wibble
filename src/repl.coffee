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
  maxHistory: 100
  historyFilename: path.join(process.env["HOME"] or process.env["USERPROFILE"] or ".", ".wibble_history")


main = (terminal) ->
  if not terminal?
    unix_terminal = require './unix_terminal'
    terminal = new unix_terminal.UnixTerminal(env.historyFilename, env.maxHistory)
  terminal.printColor("0c0", "wibble")
  terminal.printColor("080", " ¤")
  terminal.println(" jsrepl v#{package_json.version}.#{build_date.build_date}")
  terminal.println("(c) 2014-2019 Regents of Despair")
  terminal.print("Use ")
  terminal.printColor("0c0", "/help")
  terminal.println(" for help with meta-commands.")
  terminal.println()

  globalScope = new wibble.transform.Scope()
  globals = new wibble.Scope() # FIXME

  terminal.readline "e0c", "| ", ": ", (line) ->
    if not line?
      terminal.println()
      terminal.println()
      terminal.printlnColor("44f", "Goodbye!")
      terminal.println()
      terminal.exit(0)
    if line[0] == "/" then return command(terminal, line[1...])

    try
      expr = parseWibble(line)
    catch e
      # if the parse error is at the end, let the human continue typing.
      if e.state.pos() == line.length then return false
      displayError(terminal, e)
      return true

    buffer = ""
    if env.debugParse
      terminal.printColor("ff0", "  p ")
      terminal.println(wibble.dumpExpr(expr))
    try
      expr = wibble.transform.transformExpr(expr)
      expr = wibble.transform.packLocals(globalScope, expr)
    catch e
      if e.state?
        displayError(terminal, e)
      else
        # internal compiler error
        terminal.printColor("f00", e.toString() + "\n")
        terminal.println e.stack
      return true

    if env.debugCompile
      terminal.printColor("f80", "  c ")
      terminal.println(wibble.dumpExpr(expr))

    try
      logger = (line) ->
        if env.debugEval
          terminal.printColor("c70", "  × ")
          terminal.println(line)
      rv = wibble.evalExpr(expr, globals, logger)
      terminal.printColor("66f", "#{rv.type.toRepr()}: ")
      terminal.printColor("99f", rv.toRepr())
      terminal.println()
    catch e
      if e.state?
        displayError(terminal, e)
      else
        # internal compiler error
        terminal.printColor("f00", e.toString() + "\n")
        terminal.println e.stack
    true

parseWibble = (line) ->
  wibble.parser.expression.run(line)

displayError = (terminal, e) ->
  [ line, squiggles ] = e.state.toSquiggles()
  terminal.printlnColor("f88", line)
  terminal.printlnColor("f4f", squiggles)
  terminal.printColor("f00", "*** ")
  terminal.println("[#{e.state.lineno() + 1}] #{e.message}")

command = (terminal, line) ->
  # FIXME maybe use packrattle for this ;)
  args = line.split(" ")
  switch args[0]
    when "debug" then commandDebug(terminal, args[1...])
    else commandHelp(terminal)
  true

commandHelp = (terminal) ->
  terminal.println "Type any wibble expression to have it evaluated."
  terminal.println "(January edition: only supports integer math.)"
  terminal.println ""
  terminal.println "Meta-commands:"
  terminal.println "  /debug [options...]"
  terminal.println "      turn on/off various debug logging (parse, compile, eval)"
  terminal.println "      example: /debug +eval -parse"

commandDebug = (terminal, options) ->
  for x in options then switch x
    when "+parse" then env.debugParse = true
    when "-parse" then env.debugParse = false
    when "+compile" then env.debugCompile = true
    when "-compile" then env.debugCompile = false
    when "+eval" then env.debugEval = true
    when "-eval" then env.debugEval = false
    else terminal.println "(Don't understand '#{x}'; ignoring.)"
  terminal.println [
    if env.debugParse then "+parse" else "-parse"
    if env.debugCompile then "+compile" else "-compile"
    if env.debugEval then "+eval" else "-eval"
  ].join(" ")


exports.main = main
