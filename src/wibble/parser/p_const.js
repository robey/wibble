"use strict";

const $ = require("packrattle");
const p_common = require("./p_common");
const util = require("../common/util");
const wenum = require("../common/wenum");

/*
 * parse constants
 */

const PConstantType = new wenum.Enum([
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
    let rv = `const(${PConstantType.name(this.type)}, ${this.value})`;
    if (this.comment) rv += "#\"" + util.cstring(this.comment) + "\"";
    rv += `[${this.span.start}:${this.span.end}]`;
    return rv;
  }
}


// ----- parsers

const nothing = $("()").map((value, span) => new PConstant(PConstantType.NOTHING, null, span));

const boolean = $.alt("true", "false").map((value, span) => {
  return new PConstant(PConstantType.BOOLEAN, value == "true", span);
});

const symbolRef = $([
  $.drop(".").commit(),
  $.alt(
    $(p_common.SYMBOL_NAME).map(match => match[0]),
    ...(p_common.OPERATORS)
  ).onFail("Invalid symbol name after .")
]).map((match, span) => new PConstant(PConstantType.SYMBOL, match[0], span));

// reserved symbol namespace for messages that ALL objects respond to. (:inspect, for example)
// FIXME i don't think i like this.
const internalSymbolRef = $([
  $.drop($.commit(":")),
  p_common.SYMBOL_NAME
]).map((match, span) => new PConstant(PConstantType.SYMBOL, ":" + match[0][0], span));

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

const cstring = $([
  $.commit(/"(([^"\\]|\\.)*)/),
  $('"').onFail("Unterminated string")
]).map((match, span) => new PConstant(PConstantType.STRING, util.uncstring(match[0][1]), span));

const constant = $.alt(
  nothing,
  boolean,
  symbolRef,
  internalSymbolRef,
  numberBase10,
  numberBase16,
  numberBase2,
  cstring
).named("constant");

exports.constant = constant;
// exports.internalSymbolRef = internalSymbolRef
// exports.symbolRef = symbolRef
