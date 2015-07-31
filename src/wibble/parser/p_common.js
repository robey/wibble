"use strict";

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


exports.OPERATORS = OPERATORS;
exports.RESERVED = RESERVED;
exports.SYMBOL_NAME = SYMBOL_NAME;
exports.TYPE_NAME = TYPE_NAME;
