antsy = require 'antsy'
fs = require 'fs'
readline = require 'readline'

# abstract the unix terminal into a few simple functions, so the website can inject its own.
class UnixTerminal
  constructor: (@historyFilename, @maxHistory) ->
    @println ""

  print: (text) -> process.stdout.write(text)
  println: (text = "") -> process.stdout.write(text + "\n")

  colorize: (color, text) ->
    "\u001b[38;5;#{antsy.get_color(color)}m#{text}\u001b[0m"

  printColor: (color, text) ->
    process.stdout.write(@colorize(color, text))

  printlnColor: (color, text) ->
    @printColor(color, text)
    process.stdout.write("\n")

  printUrl: (url) ->
    # no special support
    @print(url)

  readline: (color, prompt, contPrompt, handler) ->
    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    if readline.kHistorySize < @maxHistory then readline.kHistorySize = @maxHistory
    r = readline.createInterface(input: process.stdin, output: process.stdout, terminal: true)
    # fucking history
    r._old_addHistory = r._addHistory
    historyFilename = @historyFilename
    r._addHistory = ->
      line = @_old_addHistory()
      fs.writeFileSync historyFilename, @history.join("\n") + "\n"
      line
    # inject old history
    try
      lines = fs.readFileSync(@historyFilename, encoding: "utf-8").split("\n").filter (x) -> x != ""
      for line in lines then r.history.push(line)
    catch e
      # forget it.
    # the length must be handed on a silver platter because readline is bad at unicode len()
    r.setPrompt("| ")#@colorize(color, prompt), prompt.length)
    r.prompt()
    buffer = ""
    r.addListener 'line', (line) =>
      line = buffer + line
      if line[line.length - 1] != "\\" and handler(line) then buffer = "" else buffer = line + "\n"
      p = if buffer.length > 0 then contPrompt else prompt
      r.setPrompt("| ")#@colorize(color, p), p.length)
      r.prompt()
    r.addListener 'SIGINT', =>
      printlnColor "f00", "^C"
      if buffer.length > 0
        buffer = ""
        r.setPrompt(@colorize(color, prompt), prompt.length)
        r.prompt()
      else
        handler(null)
        process.stdin.destroy()
    r.addListener 'close', ->
      handler(null)
      process.stdin.destroy()

  exit: (code) ->
    process.exit(code)


exports.UnixTerminal = UnixTerminal
