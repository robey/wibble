"use strict";

import $ from "packrattle";

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

export function isReserved(s) {
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

export { SYMBOL_NAME, TYPE_NAME, OPERATORS };

// const comment = $(/\#[^\n]*/).drop();

// line may be continued with "\"
const linespace = $.optional(/([ ]+|\\[ ]*\n)+/, null);

// linefeed is acceptable whitespace here
const whitespace = $.optional(/([ \n]+|\\\n|\#[^\n]*\n)+/, null);

const commentspace = whitespace.map(match => {
  if (!match) return match;
  return match[0].split("\n").map(x => x.trim()).filter(x => x[0] == "#").join("\n");
});

export { linespace, whitespace, commentspace };

// match a keyword, commit on it, and turn it into its covering span.
export function toSpan(p) {
  return $(p).commit().map((match, span) => span);
}

// match: ws p (linespace separator ws p)* (linespace separator)?
// if ws isn't dropped, it's added to the result of p as a 'comment' field.
export function repeatSeparated(p, separator, ws) {
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
export function repeatSurrounded(open, p, separator, close, ws, name) {
  return $([
    $.drop(open),
    $([
      repeatSeparated(p, separator, ws),
      ws,
      $.drop(close)
    ]).named(name)
  ]).map(match => match[0]);
}
