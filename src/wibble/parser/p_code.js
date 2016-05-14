"use strict";

import $ from "packrattle";
import { linespace, toSpan } from "./p_common";
import { expression, PExpr } from "./p_expr";
import { compoundType, typedecl } from "./p_type";

// p_common = require './p_common'
// p_const = require './p_const'
// p_expr = require './p_expr'
//
// blockOf = p_common.blockOf
// internalSymbolRef = p_const.internalSymbolRef
// symbolRef = p_const.symbolRef
// SYMBOL_NAME = p_common.SYMBOL_NAME
// toState = p_common.toState
// typedecl = p_type.typedecl

/*
 * parse code
 */

class PFunction extends PExpr {
  constructor(inType, outType, body, span) {
    super(`Function(${inType ? inType.inspect() : "none"} -> ${outType ? outType.inspect() : "none"})`, span, [ body ]);
  }
}


// ----- parsers

export const func = $([
  $.optional(compoundType, ""),
  $.drop(linespace),
  $.optional([ $.drop(":"), $.drop(linespace), typedecl, $.drop(linespace) ], ""),
  toSpan("->"),
  $.drop(linespace),
  () => expression
]).map(match => {
  if (match[0] == "") match[0] = null;
  if (match[1] == "") match[1] = null;
  return new PFunction(match[0], match[1] ? match[1][0] : null, match[3], match[2]);
});

// # preserve location of name
// localName = pr(SYMBOL_NAME).onMatch (m, state) -> { name: m[0], state }
//
// localVal = pr([
//   pr([ "mutable", linespace ]).optional([])
//   localName
//   linespace
//   pr("=").commit().drop()
//   linespace
//   (-> expression)
// ]).onMatch (m, state) ->
//   { local: m[1], value: m[2], mutable: m[0].length > 0, state: m[1].state }
//
// assignment = pr([ localName, linespace, toState(":="), linespace, (-> expression) ]).onMatch (m, state) ->
//   { assignment: m[0].name, value: m[2], state: m[1] }
//
// handlerReceiver = pr.alt(symbolRef, internalSymbolRef, compoundType).describe("symbol or parameters")
//
// handler = pr([ toState("on"), linespace, handlerReceiver, linespace, pr("->").drop(), whitespace, expression ]).onMatch (m, state) ->
//   { on: m[1], handler: m[2], state: m[0] }
//
// returnEarly = pr([ toState("return"), linespace, expression ]).onMatch (m, state) ->
//   { returnEarly: m[1], state: m[0] }
//
// code1 = pr.alt(localVal, assignment, handler, returnEarly, expression).onFail("Expected declaration or expression")
//
// code = pr([ whitespace, code1 ]).onMatch (m) -> m[0]
//
// codeBlock = blockOf(code).onMatch (m, state) ->
//   rv = { code: m.items, state: state }
//   if m.trailingComment? then rv.trailingComment = m.trailingComment
//   rv
//
//
// exports.code = code
// exports.codeBlock = codeBlock
// exports.functionx = functionx
