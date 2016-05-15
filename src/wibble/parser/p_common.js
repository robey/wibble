"use strict";

import $ from "packrattle";

export const SYMBOL_NAME = /[a-z][A-Za-z_0-9]*/;

export const TYPE_NAME = /[A-Z][A-Za-z_0-9]*/;

export const RESERVED = [
  "true",
  "false",
  "if",
  "then",
  "else",
  "match",
  "and",
  "or",
  "repeat",
  "while",
  "do",
  "not",
  "let",
  "make",
  "return",
  "break",
  "on",
  "new"
];

export function isReserved(s) {
  return RESERVED.indexOf(s) >= 0;
}

export const OPERATORS = [
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
export const linespace = $.optional(/([ ]+|\\[ ]*\n)+/, null);

// linefeed is acceptable whitespace here
const whitespace = $.optional(/([ \n]+|\\\n|\#[^\n]*\n)+/, null);
export const commentspace = whitespace.map(match => {
  if (!match) return match;
  return match[0].split("\n").map(x => x.trim()).filter(x => x[0] == "#").join("\n");
});

// match a keyword, commit on it, and turn it into its covering span.
export function toSpan(p) {
  return $.commit(p).map((match, span) => span);
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
    $.repeatSeparated(element, $([ linespace, separator ])),
    $.optional([ linespace, separator ])
  ]).map(match => match[0]);
}

// same as repeatSeparated, but with a surrounding group syntax like [ ].
// returns [ []:items, comment ] -- where comment is any non-dropped content
// from 'ws' after the last item.
// 'name' is what to name the items expected, for errors.
// an empty list is allowed.
export function repeatSurrounded(open, p, separator, close, ws, name) {
  return $([
    $.drop(open),
    $([
      repeatSeparated(p, separator, ws).optional([]),
      ws,
      $.drop(close)
    ]).named(name)
  ]).map(match => match[0]);
}
