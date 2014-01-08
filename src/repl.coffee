antsy = require 'antsy'
packrattle = require 'packrattle'
readline = require 'readline'
util = require 'util'

wibble = require './wibble'


parseWibble = (line) ->
  rv = packrattle.consume(wibble.parser.expression, line)
  if not rv.ok
    e = new Error(rv.message)
    e.state = rv.state
    throw e
  rv.match    

main = ->
  println()
  printlnColor("080", "Hello!")
  println()

  globals = new wibble.Scope()

  repl "| ", "|.. ", (line) ->
    if not line?
      println()
      println()
      printlnColor("44f", "Goodbye!")
      println()
      process.exit(0)

    try
      expr = parseWibble(line)
    catch e
      # if the parse error is at the end, let the human continue typing.
      if e.state.pos == line.length then return false
      [ line, squiggles ] = e.state.toSquiggles()
      printlnColor("f88", line)
      printlnColor("f4f", squiggles)
      printColor("f00", "\u2639\u2639\u2639 ")
      println("[#{e.state.lineno + 1}] #{e.message}")
      return true

    buffer = ""
    printColor("yellow", "  \u2691 ")
    println(wibble.dumpExpr(expr))
    expr = wibble.transformExpr(expr)
    printColor("f80", "  \u2691 ")
    println(wibble.dumpExpr(expr))

    try
      logger = (line) ->
        printColor("a50", "  \u2691 ")
        println(line)
      rv = wibble.evalExpr(expr, globals, logger)
      printColor("55f", "#{rv.type.toRepr()} ")
      printColor("88f", rv.toRepr())
      println()
    catch e
      printColor("f00", e.toString() + "\n")
    true


repl = (prompt, contPrompt, handler) ->
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  r = readline.createInterface(process.stdin, process.stdout)
  # the 3 is because readline is bad at unicode len()
  r.setPrompt(prompt, prompt.length)
  r.prompt()
  buffer = ""
  r.addListener 'line', (line) ->
    if line == "exit"
      r.close()
      return
    if line[line.length - 1] == "\\"
      buffer += line + "\n"
      r.setPrompt(" \\ ", 3)
      r.prompt()
      return
    line = buffer + line
    if handler(line) then buffer = "" else buffer = line + "\n"
    p = if buffer.length > 0 then contPrompt else prompt
    r.setPrompt(p, p.length)
    r.prompt()
  r.addListener 'close', ->
    handler(null)
    process.stdin.destroy()

print = (text) -> process.stdout.write(text)
println = (text = "") -> process.stdout.write(text + "\n")

printColor = (color, text) ->
  process.stdout.write("\u001b[38;5;#{antsy.get_color(color)}m#{text}\u001b[0m")

printlnColor = (color, text) ->
  printColor(color, text)
  process.stdout.write("\n")


exports.main = main


exports.replOLD = ->
  parser = wibble.parser
  runtime = new wibble.Runtime()
  runtime.logger = (stage, message) ->
    console.log blue(pad(stage, 5)) + " " + cyan(message)
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  buffer = ""
  r = readline.createInterface(process.stdin, process.stdout)
  # the 3 is because readline is bad at unicode len()
  r.setPrompt("\u2605> ", 3)
  r.prompt()
  r.addListener 'line', (line) ->
    if line == "exit"
      r.close()
      return
    if line[line.length - 1] == "\\"
      buffer += line + "\n"
      r.setPrompt(" \\ ", 3)
      r.prompt()
      return
    line = buffer + line
    rv = parser.repl.consume(line)
    if not rv.ok
      console.log rv.state.line()
      console.log (for i in [0 ... rv.state.xpos] then " ").join("") + red("^")
      console.log red("\u2639\u2639\u2639 ") + rv.message
    else
      expr = rv.match
      runtime.log 'parse', yellow("\u2691") + " " + wibble.dumpExpr(expr)
      expr = wibble.transform(expr)
      runtime.log 'parse', orange("\u2691") + " " + wibble.dumpExpr(expr)
      try
        rv = runtime.xeval(expr)
        console.log yellow("\u2604") + " [#{rv.type.toDebug()}] #{rv.toDebug()}"
      catch e
        console.log red("\u2639\u2639\u2639 ") + e.toString()
        throw e
    buffer = ""
    r.setPrompt("\u2605> ", 3)
    r.prompt()
    r.prompt()
  r.addListener 'close', ->
    console.log ""
    console.log "bye!"
    process.stdin.destroy()

# gray, yellow, orange, red, purple, blue, cyan, green
colors = [ "37", "33;1", "33", "31", "35", "34;1", "36", "32" ]
inColor = (colorIndex, s) -> "\u001b[" + colors[colorIndex] + "m" + s + "\u001b[0m"
yellow = (s) -> inColor(1, s)
orange = (s) -> inColor(2, s)
red = (s) -> inColor(3, s)
blue = (s) -> inColor(5, s)
cyan = (s) -> inColor(6, s)

pad = (message, len) ->
  if message.length > len then return message.slice(0, len)
  while message.length < len then message = message + " "
  message
