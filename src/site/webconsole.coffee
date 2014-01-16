# cursor blink rate (msec)
CursorRate = 750

after = (msec, f) -> setTimeout(f, msec)
startTimer = (msec, f) -> setInterval(f, msec)
stopTimer = (t) -> clearInterval(t)

class WebConsole
  constructor: (@element) ->
    @div =
      text: @element.find(".console-content")
      cursor: @element.find(".console-cursor")
    after 1, => @init()

  init: ->
    @calculateEm()
    @cursor =
      x: 0
      y: 0
    @lines = []
    @color = 0xfff
    @addLine()

  resize: ->
    @lineHeight = parseInt(@element.css("line-height"))
    @width = Math.floor(@div.text.width() / @em)
    @startCursor()

  putChar: (c) ->
    if @cursor.x >= @width
      @addLine()
      @cursor.x = 0
      @cursor.y += 1
    @lines[@cursor.y][@cursor.x] = { color: @color, char: c }
    @redrawLine(@cursor.y)
    @cursor.x += 1
    @moveCursor()

  addLine: ->
    @lines.push []
    @div.text.append($("<span></span><br>"))
    # FIXME: scroll

  redrawLine: (y) ->
    span = $(@div.text.children("span")[y])
    span.empty()
    span.append(@lines[y].map((cell) -> cell.char).join(""))

  calculateEm: ->
    # gerg-style: non-retina computers may use fractional pixel-widths for text
    count = 100
    zeros = (for i in [0...count] then "0").join("")
    eyes = (for i in [0...count] then "i").join("")
    span = $("<span>#{zeros}</span>")
    @div.text.append(span)
    em0 = span.outerWidth(true) / count
    span.remove()
    span = $("<span>#{eyes}</span>")
    @div.text.append(span)
    em1 = span.outerWidth(true) / count
    span.remove()
    # it's possible that the font hasn't loaded yet.
    # check that the em is real, and "0" and "i" are the same width.
    # (we trick chrome by making the fallback font proportional.)
    if em0 == 0 or Math.abs(em1 - em0) > 0.5
      after 25, => @calculateEm()
      return
    @em = em0
    @resize()

  stopCursor: ->
    if @cursorTimer? then stopTimer(@cursorTimer)
    @div.cursor.css("display", "none")

  startCursor: ->
    @stopCursor()
    @cursorTimer = startTimer CursorRate, => @blinkCursor()
    @moveCursor()

  blinkCursor: ->
    @div.cursor.css("display", if @div.cursor.css("display") == "none" then "block" else "none")

  moveCursor: ->
    padding = parseInt(@element.css("padding"))
    @div.cursor.css("width", "#{@em}px")
    @div.cursor.css("height", "#{@lineHeight}px")
    @div.cursor.css("top", "#{padding + @lineHeight * @cursor.y}px")
    @div.cursor.css("left", "#{padding + @em * @cursor.x}px")


exports.WebConsole = WebConsole
