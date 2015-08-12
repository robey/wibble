"use strict";

const $ = require("packrattle");

const SYMBOL_NAME = /[a-z][A-Za-z_0-9]*/;

const TYPE_NAME = /[A-Z][A-Za-z_0-9]*/;

const RESERVED = [
  "if",
  "then",
  "else",
  "match",
  "true",
  "false",
  "and",
  "or",
  "on",
  "val",
  "def",
  "new",
  "unless",
  "until"
];

function isReserved(s) {
  return RESERVED.indexOf(s) >= 0;
}

const OPERATORS = [
  "**",
  "*",
  "/",
  "%",
  "+",
  "-",
  "<<",
  ">>",
  "==",
  "!=",
  ">=",
  "<=",
  ">",
  "<"
];

// const comment = $(/\#[^\n]*/).drop();

// line may be continued with "\"
const linespace = $.optional(/([ ]+|\\[ ]*\n)+/, null);

// linefeed is acceptable whitespace here
const whitespace = $.optional(/([ \n]+|\\\n|\#[^\n]*\n)+/, null);

const commentspace = whitespace.map(match => {
  if (!match) return match;
  return match[0].split("\n").map(x => x.trim()).filter(x => x[0] == "#").join("\n");
});

// match a keyword, commit on it, and turn it into its covering span.
function toSpan(p) {
  return $(p).commit().map((match, span) => span);
}

// match: ws p (linespace separator ws p)* (linespace separator)?
// if ws isn't dropped, it's added to the result of p as a 'comment' field.
function repeatSeparated(p, separator, ws) {
  const element = $([ ws, p ]).map(([ comment, x ]) => {
    if (x == null) {
      // comment was dropped.
      x = comment;
      comment = null;
    }
    if (comment && comment.length > 0) x.comment = comment;
    return x;
  });

  return $([
    $.repeatSeparated(element, $([ linespace, separator ])).optional([]),
    $.optional([ linespace, separator ])
  ]).map(match => match[0]);
}

// same as repeatSeparated, but with a surrounding group syntax like [ ].
// returns [ []:items, comment ] -- where comment is any non-dropped content
// from 'ws' after the last item.
// 'name' is what to name the items expected, for errors.
function repeatSurrounded(open, p, separator, close, ws, name) {
  return $([
    $.drop(open),
    $([
      repeatSeparated(p, separator, ws),
      ws,
      $.drop(close)
    ]).named(name)
  ]).map(match => match[0]);
}


exports.commentspace = commentspace;
exports.isReserved = isReserved;
exports.linespace = linespace;
exports.OPERATORS = OPERATORS;
exports.repeatSeparated = repeatSeparated;
exports.repeatSurrounded = repeatSurrounded;
exports.RESERVED = RESERVED;
exports.SYMBOL_NAME = SYMBOL_NAME;
exports.toSpan = toSpan;
exports.TYPE_NAME = TYPE_NAME;
exports.whitespace = whitespace;
