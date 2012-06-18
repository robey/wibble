
child_process = require 'child_process'
fibers = require 'fibers'
fs = require 'fs'
glob = require 'glob'
mocha = require 'mocha'
sync = require 'sync'
util = require 'util'

exec = (args...) ->
  command = args.shift()
  process = child_process.spawn command, args
  process.stderr.on "data", (data) -> util.print(data.toString())
  process.stdout.on "data", (data) -> util.print(data.toString())
  fiber = fibers.current
  process.on 'exit', (code) -> fiber.run(code)
  fibers.yield()

run = (command) ->
  console.log "\u001b[35m+ " + command + "\u001b[0m"
  rv = exec("/bin/sh", "-c", command)
  if rv != 0
    console.error "\u001b[31m! Execution failed. :(\u001b[0m"
    process.exit(1)

checkfile = (file1, file2) ->
  data1 = fs.readFileSync(file1, "UTF-8")
  data2 = fs.readFileSync(file2, "UTF-8")
  if data1 != data2
    console.error "\u001b[31m! Files do not match: #{file1} <-> #{file2}\u001b[0m"
    process.exit(1)

# run a task inside a sync-capable fiber
synctask = (name, description, f) ->
  task name, description, -> (sync -> f())

# gray, yellow, orange, red, purple, blue, cyan, green
colors = [ "37", "33;1", "33", "31", "35", "34", "36", "32" ]
inColor = (colorIndex, s) -> "\u001b[" + colors[colorIndex] + "m" + s + "\u001b[0m"
red = (s) -> inColor(3, s)

## -----

synctask "test", "run unit tests", ->
  run "./node_modules/mocha/bin/mocha -R Progress --compilers coffee:coffee-script --colors"

synctask "build", "build javascript", ->
  run "mkdir -p lib"
  run "coffee -o lib -c src"

synctask "clean", "erase build products", ->
  run "rm -rf lib"

synctask "distclean", "erase everything that wasn't in git", ->
  run "rm -rf node_modules"

synctask "run", "wut", ->
  readline = require("readline")
  parser = require("./src/wibble/parser")
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
    rv = parser.expression.consume(line)
    if not rv.ok
      console.log rv.state.line()
      console.log (for i in [0 ... rv.state.xpos] then " ").join("") + red("^")
      console.log red("\u2639\u2639\u2639 ") + rv.message
    else
      console.log util.inspect(rv.match, false, null)
    buffer = ""
    r.setPrompt("\u2605> ", 3)
    r.prompt()
    r.prompt()
  r.addListener 'close', ->
    console.log ""
    console.log "bye!"
    process.stdin.destroy()

