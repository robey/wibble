wibble = require '../wibble'
webconsole = require './webconsole'

expr = wibble.parser.expression.run("3 * (4 + 9) + 3")
expr = wibble.transform.transformExpr(expr)
globalScope = new wibble.transform.Scope()
globals = new wibble.Scope()
expr = wibble.transform.packLocals(globalScope, expr)
rv = wibble.evalExpr(expr, globals)
console.log rv.toRepr()

@Padding = 50

after = (msec, f) -> setTimeout(f, msec)

$(document).ready ->
  # don't try to race chrome.
  document.webconsole = new webconsole.WebConsole($(".console"))
  after 1, -> @resized()
  $(window).resize (event) ->
    after 1, -> @resized()
    return null

@resized = ->
  # lame html/css makes us recompute the size of the scrollable region for hand-holding purposes.
  width = $("body").width()
  height = $("body").height()
  consoleHeight = height - Padding * 2
  console.log "resize to #{width} x #{height}"
  $(".console").css("width", "#{width - Padding * 2}px")
  $(".console").css("height", "#{consoleHeight}px")
  $(".console").css("position", "relative")
  $(".console").css("top", "#{Padding}px")
  $(".console").css("left", "#{Padding}px")
  $(".console").css("display", "block")
  # FIXME dont do this
  after 2000, ->
    h = $(".console .console-content").height()
    console.log "h=#{h}"
    $(".console").scrollTop(parseInt(h))
    console.log "top=#{$(".console").scrollTop()}"
    @randChar()

@randChar = ->
  if Math.random() <= 0.2
    document.webconsole.putChar(" ")
  else
    if Math.random() <= 0.1
      document.webconsole.color = ((Math.floor(Math.random() * 5) + 10) << 8) + ((Math.floor(Math.random() * 5) + 10) << 4) + ((Math.floor(Math.random() * 5) + 10))
    ch = Math.floor(Math.random() * 25 + 97)
    if ch < 97 or ch > 126 then console.log "WUT #{ch}"
    document.webconsole.putChar(String.fromCharCode(ch))
  after 20 + 50 * Math.random(), => @randChar()
