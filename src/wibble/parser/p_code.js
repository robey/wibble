"use strict";

import $ from "packrattle";
import { commentspace, linespace, repeatSeparated, repeatSurrounded, toSpan } from "./p_common";
import { symbolRef } from "./p_const";
import { expression, PExpr, reference } from "./p_expr";
import { compoundType, typedecl } from "./p_type";

/*
 * parse code
 */

class PFunction extends PExpr {
  constructor(inType, outType, body, span) {
    super(`function(${inType ? inType.inspect() : "none"} -> ${outType ? outType.inspect() : "none"})`, span, [ body ]);
  }
}

class PLocal extends PExpr {
  constructor(name, expr, mutable) {
    super(mutable ? "make" : "let", name.span, [ name, expr ]);
  }
}

class PLocals extends PExpr {
  constructor(span, locals) {
    super("locals", span, locals);
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

function localDeclaration(operator, mutable) {
  return $([
    reference.named("identifier"),
    $.drop(linespace),
    $.drop(operator),
    $.drop(linespace),
    () => expression
  ]).map(match => {
    return new PLocal(match[0], match[1], mutable);
  });
}

const localLet = $([
  toSpan("let"),
  repeatSeparated(localDeclaration("=", false), ",", $.drop(linespace))
]).map(match => {
  return new PLocals(match[0], match[1]);
});

const localMake = $([
  toSpan("make"),
  repeatSeparated(localDeclaration(":=", true), ",", $.drop(linespace))
]).map(match => {
  return new PLocals(match[0], match[1]);
});

const handlerReceiver = $.alt(() => symbolRef, () => compoundType).named("symbol or parameters");
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
