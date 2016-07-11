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

export const lf = $(/[\n;]+/).named("linefeed or ;");

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

// match: p (linespace separator ws p)* (linespace separator)?
// if ws isn't dropped, it's added to the result of p as a 'comment' field.
export function repeatSeparated(p, separator, ws) {
  const element = $([ $.drop(linespace), $.drop(separator), ws, p ]).map(list => {
    if (list.length == 1) return list[0];
    const item = list[1];
    item.comment = list[0];
    return item;
  });

  return $([
    p,
    $.repeat(element),
    $.optional([ linespace, separator ])
  ]).map(match => [ match[0] ].concat(match[1]));
}

// open (ws p (linespace separator ws p)* (linespace separator)?)? ws close
// returns: [ []:items, comment ]
export function repeatSurrounded(open, p, separator, close, ws, name) {
  return $([
    $.drop(open),
    $.optional([
      ws,
      repeatSeparated(p, separator, ws)
    ], [ [] ]),
    ws,
    $.drop(close).named(name)
  ]).map(match => {
    // [ [ ws?, []:items ], ws? ]
    const items = match[0].length == 1 ? match[0][0] : match[0][1];
    // there will only be a leading comment if there were any items.
    if (match[0].length > 1) items[0].comment = match[0][0];
    return [ items, match[1] ];
  });
}
