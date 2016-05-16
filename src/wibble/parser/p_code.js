"use strict";

import $ from "packrattle";
import { commentspace, linespace, repeatSeparated, repeatSurrounded, toSpan } from "./p_common";
import { symbolRef } from "./p_const";
import { expression, PExpr, reference } from "./p_expr";
import { compoundType } from "./p_type";

/*
 * parse code
 */

class PLocal extends PExpr {
  constructor(name, expr) {
    super("local", name.span, [ name, expr ]);
  }
}

class PLocals extends PExpr {
  constructor(span, locals, mutable) {
    super(mutable ? "make" : "let", span, locals);
    this.mutable = mutable;
  }
}

class POn extends PExpr {
  constructor(receiver, expr, span) {
    super("on", span, [ receiver, expr ]);
  }
}

class PBlock extends PExpr {
  constructor(codes, trailingComment, span) {
    super("block", span, codes);
    this.trailingComment = trailingComment;
  }
}


// ----- parsers

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
  $.drop("->"),
  $.drop(linespace),
  () => expression
]).map(match => {
  return new POn(match[1], match[2], match[0]);
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
