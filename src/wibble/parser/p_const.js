"use strict";

import $ from "packrattle";
import Enum from "../common/enum";
import { cstring, uncstring } from "../common/strings";
import { OPERATORS, SYMBOL_NAME } from "./p_common";

/*
 * parse constants
 */

const PConstantType = new Enum([
  "NOTHING",
  "BOOLEAN",
  "SYMBOL",
  "NUMBER_BASE10",
  "NUMBER_BASE16",
  "NUMBER_BASE2",
  "STRING"
]);

class PConstant {
  constructor(type, value, span) {
    this.type = type;
    this.value = value;
    this.span = span;
  }

  inspect() {
    let rv = this.type == PConstantType.NOTHING ?
      "const(NOTHING)" :
      `const(${PConstantType.name(this.type)}, ${this.value})`;
    if (this.comment) rv += "#\"" + cstring(this.comment) + "\"";
    rv += `[${this.span.start}:${this.span.end}]`;
    return rv;
  }
}


// ----- parsers

const nothing = $("()").map((value, span) => new PConstant(PConstantType.NOTHING, null, span));

const boolean = $.alt("true", "false").map((value, span) => {
  return new PConstant(PConstantType.BOOLEAN, value == "true", span);
});

export const symbolRef = $([
  $.drop(".").commit(),
  $.alt(
    $(SYMBOL_NAME).map(match => match[0]),
    ...(OPERATORS)
  ).onFail("Invalid symbol name after .")
]).map((match, span) => new PConstant(PConstantType.SYMBOL, match[0], span));

const numberBase10 = $([
  /[0-9_]+/,
  $([ ".", /[0-9_]+/ ]).map(match => match.join("")).optional(),
  $([ /[eE][-+]?/, /[0-9_]+/ ]).map(match => match.join("")).optional()
]).map((match, span) => new PConstant(PConstantType.NUMBER_BASE10, match.join(""), span));

const numberBase16 = $([
  $.drop($.commit("0x")),
  $(/[0-9a-fA-F_]+/).onFail("Hex constant must contain only 0-9, A-F, _")
]).map((match, span) => {
  return new PConstant(PConstantType.NUMBER_BASE16, match[0], span);
});

const numberBase2 = $([
  $.drop($.commit("0b")),
  $(/[01_]+/).onFail("Binary constant must contain only 0, 1, _")
]).map((match, span) => {
  return new PConstant(PConstantType.NUMBER_BASE2, match[0], span);
});

const string = $([
  $.commit(/"(([^"\\]|\\.)*)/),
  $("\"").onFail("Unterminated string")
]).map((match, span) => new PConstant(PConstantType.STRING, uncstring(match[0][1]), span));

export const constant = $.alt(
  nothing,
  boolean,
  symbolRef,
  numberBase10,
  numberBase16,
  numberBase2,
  string
).named("constant");
