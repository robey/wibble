"use strict";

import $ from "packrattle";
import { PBlock, PLocal, PLocals, POn } from "../common/ast";
import { commentspace, linespace, repeatSeparated, repeatSurrounded, toSpan } from "./p_common";
import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions which can only be in a code block.
 */

function localDeclaration(operator) {
  return $([
    reference.named("identifier"),
    $.drop(linespace),
    $.drop(operator),
    $.drop(linespace),
    () => expression
  ]).map(match => {
    return new PLocal(match[0], match[1]);
  });
}

const localLet = $([
  toSpan("let"),
  repeatSeparated(localDeclaration("="), ",", $.drop(linespace))
]).map(match => {
  return new PLocals(match[0], match[1], false);
});

const localMake = $([
  toSpan("make"),
  repeatSeparated(localDeclaration(":="), ",", $.drop(linespace))
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
  handler,
  () => expression
).named("declaration or expression");

const lf = $(/[\n;]+/).named("linefeed or ;");
export const codeBlock = repeatSurrounded($.commit("{"), code, lf, "}", commentspace).map((match, span) => {
  return new PBlock(match[0], match[1], span);
});
