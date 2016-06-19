"use strict";

import $ from "packrattle";
import { PAssignment, PBlock, PBreak, PLocal, PLocals, POn, PReturn } from "../common/ast";
import { commentspace, linespace, repeatSeparated, repeatSurrounded, toSpan } from "./p_common";
import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions which can only be in a code block.
 */

const assignment = $([
  reference,
  $.drop(linespace),
  toSpan(":="),
  $.drop(linespace),
  () => code
]).named("assignment").map(match => {
  return new PAssignment(match[0], match[2], match[1]);
});

const returnEarly = $([ toSpan("return"), $.drop(linespace), () => code ]).named("return").map(match => {
  return new PReturn(match[1], match[0]);
});

const breakEarly = $([ toSpan("break"), $.drop(linespace), $.optional(() => code) ]).named("break").map(match => {
  return new PBreak(match[1], match[0]);
});

function localDeclaration(operator, mutable) {
  return $([
    reference.named("identifier"),
    $.drop(linespace),
    $.drop(operator),
    $.drop(linespace),
    () => expression
  ]).map(match => {
    return new PLocal(match[0].name, match[1], match[0].span, mutable);
  });
}

const localLet = $([
  toSpan("let"),
  $.drop(linespace),
  repeatSeparated(localDeclaration("=", false), ",", $.drop(linespace))
]).map(match => {
  return new PLocals(match[0], match[1], false);
});

const localMake = $([
  toSpan("make"),
  $.drop(linespace),
  repeatSeparated(localDeclaration(":=", true), ",", $.drop(linespace))
]).map(match => {
  return new PLocals(match[0], match[1], true);
});

const handlerReceiver = $.alt(symbolRef, compoundType).named("symbol or parameters");
const handler = $([
  toSpan("on"),
  $.drop(linespace),
  handlerReceiver,
  $.drop(linespace),
  $.optional([ $.drop(":"), $.drop(linespace), typedecl, $.drop(linespace) ], ""),
  $.drop("->"),
  $.drop(linespace),
  () => expression
]).map(match => {
  if (match[2] == "") match[2] = [ null ];
  return new POn(match[1], match[3], match[2][0], match[0]);
});

export const code = $.alt(
  localLet,
  localMake,
  assignment,
  returnEarly,
  breakEarly,
  handler,
  () => expression
).named("expression");

const lf = $(/[\n;]+/).named("linefeed or ;");
export const codeBlock = repeatSurrounded(
  $.commit("{"),
  code,
  lf,
  "}",
  commentspace,
  "declaration or expression"
).map((match, span) => {
  return new PBlock(match[0], match[1], span);
});
