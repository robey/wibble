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
  document.console = new webconsole.WebConsole($(".console"))
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