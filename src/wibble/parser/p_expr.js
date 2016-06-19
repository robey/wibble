"use strict";

import $ from "packrattle";
import {
  PArray, PBinary, PCall, PFunction, PIf, PNew, PReference, PRepeat, PStruct,
  PStructField, PUnary, PWhile
} from "../common/ast";
import { code, codeBlock } from "./p_code";
import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan } from "./p_common";
import { constant } from "./p_const";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions
 */

const ReservedError = "Reserved word can't be used as identifier";
export const reference = $(SYMBOL_NAME).filter(match => !isReserved(match[0]), ReservedError).map((match, span) => {
  return new PReference(match[0], span);
});

const xarray = repeatSurrounded(
  $.commit("["),
  () => code,
  /[\n,]+/,
  $.commit("]"),
  commentspace,
  "array element"
).map(([ items, comment ], span) => {
  return new PArray(items, comment, span);
}).named("array");

export const func = $([
  $.optional([
    compoundType,
    $.drop(linespace),
    $.optional([ $.drop(":"), $.drop(linespace), typedecl, $.drop(linespace) ])
  ], []),
  toSpan("->"),
  $.drop(linespace),
  () => code
]).named("function").map(match => {
  return new PFunction(match[0][0], match[0][1] ? match[0][1][0] : null, match[2], match[1]);
});

const structMember = $([
  $.optional([ SYMBOL_NAME, linespace, "=", linespace ], []),
  () => code
]).map(([ prefix, value ], span) => {
  return new PStructField(prefix.length > 0 ? prefix[0][0] : null, value, span);
});

const struct = repeatSurrounded(
  $.commit("("),
  structMember,
  /[\n,]+/,
  $.commit(")"),
  commentspace,
  "struct member"
).map(([ items, comment ], span) => {
  // AST optimization: "(expr)" is just a precedence-bumped expression.
  if (items.length == 1 && items[0].name == null) return items[0].children[0];
  return new PStruct(items, comment, span);
}).named("struct");

const newObject = $([
  toSpan("new"),
  $.drop(linespace),
  () => codeBlock
]).map(([ span, code ]) => new PNew(code, span));

const atom = $.alt(
  constant,
  reference,
  xarray,
  struct,
  () => codeBlock,
  newObject
).named("atom");

const unary = $.alt(
  [ $.commit(/(-(?!>)|not)/), $.drop(linespace), () => unary ],
  [ atom ]
).named("unary").map(([ op, expr ], span) => {
  if (!expr) return op;
  return new PUnary(op[0], expr, span);
});

const call = $([
  unary,
  $.repeatIgnore(atom, linespace)
]).map(([ first, rest ]) => {
  return [ first ].concat(rest).reduce((x, y) => new PCall(x, y, x.span.merge(y.span)));
});

// helper
function binary(subexpr, op) {
  const sep = $.commit([ $.drop(linespace), op, commentspace ]);
  return $.reduce($(subexpr).named("operand"), sep, {
    first: x => x,
    next: (left, [ op, comment ], right) => {
      const binary = new PBinary(left, op, right, left.span.merge(right.span));
      if (comment) binary.comment = comment;
      return binary;
    }
  }).named("binary(" + op + ")");
}

const power = binary(call, "**");
const factor = binary(power, $.alt("*", "/", "%"));
const term = binary(factor, $.alt("+", "-"));
const comparison = binary(term, $.alt("==", ">=", "<=", "!=", "<", ">"));
const logicalAnd = binary(comparison, "and");
const logical = binary(logicalAnd, "or");

const condition = $([
  toSpan("if"),
  $.drop(linespace),
  () => code,
  $.drop(linespace),
  toSpan("then"),
  $.drop(linespace),
  () => code,
  $.optional([
    $.drop(linespace),
    toSpan("else"),
    $.drop(linespace),
    () => code
  ], []).named("else clause")
]).named("condition").map(match => {
  return new PIf(match[1], match[3], (match[4].length > 0) ? match[4][1] : null, match[0]);
});

const repeatLoop = $([
  toSpan("repeat"),
  $.drop(linespace),
  () => code
]).named("repeat").map(match => new PRepeat(match[1], match[0]));

const whileLoop = $([
  toSpan("while"),
  $.drop(linespace),
  () => code,
  $.drop(linespace),
  $.commit("do").drop(),
  $.drop(linespace),
  () => code
]).named("while").map(match => new PWhile(match[1], match[2], match[0]));

const baseExpression = $.alt(condition, repeatLoop, whileLoop, func, logical);

export const expression = baseExpression;
