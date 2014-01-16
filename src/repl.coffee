antsy = require 'antsy'
fs = require 'fs'
packrattle = require 'packrattle'
path = require 'path'
readline = require 'readline'
util = require 'util'

wibble = require './wibble'

env =
  debugParse: false
  debugCompile: false
  debugEval: false
  maxHistory: 100
  historyFilename: path.join(process.env["HOME"] or process.env["USERPROFILE"], ".wibble_history")


main = ->
  println()
  printlnColor("080", "Hello!")
  println()

  globalScope = new wibble.transform.Scope()
  globals = new wibble.Scope() # FIXME

  repl "| ", ": ", (line) ->
    if not line?
      println()
      println()
      printlnColor("44f", "Goodbye!")
      println()
      process.exit(0)
    if line[0] == "/" then return command(line[1...])

    try
      expr = parseWibble(line)
    catch e
      # if the parse error is at the end, let the human continue typing.
      if e.state.pos() == line.length then return false
      displayError(e)
      return true

    buffer = ""
    if env.debugParse
      printColor("yellow", "  \u2691 ")
      println(wibble.dumpExpr(expr))
    try
      expr = wibble.transform.transformExpr(expr)
      expr = wibble.transform.packLocals(globalScope, expr)
    catch e
      if e.state?
        displayError(e)
      else
        # internal compiler error
        printColor("f00", e.toString() + "\n")
        println e.stack
      return true

    if env.debugCompile
      printColor("f80", "  \u2691 ")
      println(wibble.dumpExpr(expr))

    try
      logger = (line) ->
        if env.debugEval
          printColor("a50", "  \u2691 ")
          println(line)
      rv = wibble.evalExpr(expr, globals, logger)
      printColor("55f", "#{rv.type.toRepr()}: ")
      printColor("88f", rv.toRepr())
      println()
    catch e
      if e.state?
        displayError(e)
      else
        # internal compiler error
        printColor("f00", e.toString() + "\n")
        println e.stack
    true

parseWibble = (line) ->
  wibble.parser.expression.run(line)

displayError = (e) ->
  [ line, squiggles ] = e.state.toSquiggles()
  printlnColor("f88", line)
  printlnColor("f4f", squiggles)
  printColor("f00", "*** ")
  println("[#{e.state.lineno + 1}] #{e.message}")

command = (line) ->
  # FIXME maybe use packrattle for this ;)
  args = line.split(" ")
  switch args[0]
    when "debug" then commandDebug(args[1...])
    else commandHelp()

commandHelp = ->
  println "Meta-commands:"
  println "  /debug [options...]"
  println "      turn on/off various debug logging (parse, compile, eval)"
  println "      example: /debug +eval -parse"

commandDebug = (options) ->
  for x in options then switch x
    when "+parse" then env.debugParse = true
    when "-parse" then env.debugParse = false
    when "+compile" then env.debugCompile = true
    when "-compile" then env.debugCompile = false
    when "+eval" then env.debugEval = true
    when "-eval" then env.debugEval = false
    else println "(Don't understand '#{x}'; ignoring.)"
  println [
    if env.debugParse then "+parse" else "-parse"
    if env.debugCompile then "+compile" else "-compile"
    if env.debugEval then "+eval" else "-eval"
  ].join(" ")

repl = (prompt, contPrompt, handler) ->
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  if readline.kHistorySize < env.maxHistory then readline.kHistorySize = env.maxHistory
  r = readline.createInterface(process.stdin, process.stdout)
  # fucking history
  r._old_addHistory = r._addHistory
  r._addHistory = ->
    line = @_old_addHistory()
    writeHistoryFile(@history)
    line
  # inject old history
  try
    lines = fs.readFileSync(env.historyFilename, encoding: "utf-8").split("\n").filter (x) -> x != ""
    for line in lines then r.history.push(line)
  catch e
    # forget it. 
  # the length must be handed on a silver platter because readline is bad at unicode len()
  r.setPrompt(prompt, prompt.length)
  r.prompt()
  buffer = ""
  r.addListener 'line', (line) ->
    if line == "exit"
      r.close()
      return
    line = buffer + line
    if line[line.length - 1] != "\\" and handler(line) then buffer = "" else buffer = line + "\n"
    p = if buffer.length > 0 then contPrompt else prompt
    r.setPrompt(p, p.length)
    r.prompt()
  r.addListener 'SIGINT', ->
    printlnColor "f00", "^C"
    if buffer.length > 0
      buffer = ""
      r.setPrompt(prompt, prompt.length)
      r.prompt()
    else
      handler(null)
      process.stdin.destroy()
  r.addListener 'close', ->
    handler(null)
    process.stdin.destroy()

writeHistoryFile = (lines) ->
  fs.writeFileSync env.historyFilename, lines.join("\n") + "\n"

print = (text) -> process.stdout.write(text)
println = (text = "") -> process.stdout.write(text + "\n")

printColor = (color, text) ->
  process.stdout.write("\u001b[38;5;#{antsy.get_color(color)}m#{text}\u001b[0m")

printlnColor = (color, text) ->
  printColor(color, text)
  process.stdout.write("\n")


exports.main = main
