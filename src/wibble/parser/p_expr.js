"use strict";

import $ from "packrattle";
import { cstring } from "../common/strings";
import { codeBlock } from "./p_code";
import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan } from "./p_common";
import { constant } from "./p_const";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions
 */

export class PExpr {
  constructor(description, span, children) {
    this.description = description;
    this.span = span;
    this.children = children || [];
  }

  inspect() {
    let rv = this.description;
    if (this.children.length > 0) {
      rv += "(" + this.children.map(c => c.inspect()).join(", ") + ")";
    }
    if (this.comment) rv += "#\"" + cstring(this.comment) + "\"";
    if (this.trailingComment) rv += "##\"" + cstring(this.trailingComment) + "\"";
    rv += "[" + this.span.start + ":" + this.span.end + "]";
    return rv;
  }
}

class PReference extends PExpr {
  constructor(name, span) {
    super(name, span);
    this.name = name;
  }
}

class PArray extends PExpr {
  // 'trailingComment' is any comment after the final item.
  constructor(children, trailingComment, span) {
    super("array", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

class PFunction extends PExpr {
  constructor(inType, outType, body, span) {
    super(`function(${inType ? inType.inspect() : "none"} -> ${outType ? outType.inspect() : "none"})`, span, [ body ]);
    this.inType = inType;
    this.outType = outType;
    this.precedence = 100;
  }
}

class PStructField extends PExpr {
  constructor(name, value, span) {
    super("field" + (name ? `(${name})` : ""), span, [ value ]);
    this.name = name;
  }
}

class PStruct extends PExpr {
  constructor(children, trailingComment, span) {
    super("struct", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

class PNew extends PExpr {
  constructor(code, span) {
    super("new", span, [ code ]);
    this.precedence = 100;
  }
}

class PUnary extends PExpr {
  constructor(op, expr, span) {
    super("unary(" + op + ")", span, [ expr ]);
    this.op = op;
    this.precedence = 1;
  }
}

class PCall extends PExpr {
  constructor(left, right, span) {
    super("call", span, [ left, right ]);
    this.precedence = 2;
  }
}

class PBinary extends PExpr {
  constructor(left, op, right, span) {
    super("binary(" + op + ")", span, [ left, right ]);
    this.op = op;
    switch(op) {
      case "**":
        this.precedence = 3;
        break;
      case "*":
      case "/":
      case "%":
        this.precedence = 4;
        break;
      case "+":
      case "-":
        this.precedence = 5;
        break;
      case "<":
      case ">":
      case "==":
      case "!=":
      case "<=":
      case ">=":
        this.precedence = 6;
        break;
      case "and":
        this.precedence = 7;
        break;
      case "or":
        this.precedence = 8;
        break;
      default:
        throw new Error("No precedence for " + op);
    }
  }
}

class PIf extends PExpr {
  constructor(condition, onTrue, onFalse, span) {
    super("if", span, (onFalse != null) ? [ condition, onTrue, onFalse ] : [ condition, onTrue ]);
    this.precedence = 9;
  }
}

class PRepeat extends PExpr {
  constructor(expr, span) {
    super("repeat", span, [ expr ]);
    this.precedence = 9;
  }
}

class PWhile extends PExpr {
  constructor(condition, expr, span) {
    super("while", span, [ condition, expr ]);
    this.precedence = 9;
  }
}

class PAssignment extends PExpr {
  constructor(name, expr, span) {
    super("assign", span, [ name, expr ]);
    this.precedence = 10;
  }
}

class PReturn extends PExpr {
  constructor(expr, span) {
    super("return", span, [ expr ]);
  }
}

class PBreak extends PExpr {
  constructor(expr, span) {
    super("break", span, expr ? [ expr ] : null);
  }
}


// ----- parsers

const ReservedError = "Reserved word can't be used as identifier";
export const reference = $(SYMBOL_NAME).filter(match => !isReserved(match[0]), ReservedError).map((match, span) => {
  return new PReference(match[0], span);
});

const xarray = repeatSurrounded(
  $.commit("["),
  () => expression,
  /[\n,]+/,
  $.commit("]"),
  commentspace,
  "array items"
).map(([ items, comment ], span) => {
  return new PArray(items, comment, span);
}).named("array");

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

const structMember = $([
  $.optional([ SYMBOL_NAME, linespace, "=", linespace ], []),
  () => expression
]).map(([ prefix, value ], span) => {
  return new PStructField(prefix.length > 0 ? prefix[0][0] : null, value, span);
});

const struct = repeatSurrounded(
  $.commit("("),
  structMember,
  /[\n,]+/,
  ")",
  commentspace,
  "struct member"
).map(([ items, comment ], span) => {
  // AST optimization: "(expr)" is just a precedence-bumped expression.
  if (items.length == 1 && !items[0].fieldname) return items[0].children[0];
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
  $.optional(linespace).drop(),
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
  () => expression,
  $.drop(linespace),
  toSpan("then"),
  $.drop(linespace),
  () => expression,
  $.optional([
    $.drop(linespace),
    toSpan("else"),
    $.drop(linespace),
    () => expression
  ], [])
]).named("condition").map(match => {
  return new PIf(match[1], match[3], (match[4].length > 0) ? match[4][1] : null, match[0]);
});

const repeatLoop = $([
  toSpan("repeat"),
  $.drop(linespace),
  () => expression
]).map(match => new PRepeat(match[1], match[0]));

const whileLoop = $([
  toSpan("while"),
  $.drop(linespace),
  () => expression,
  $.drop(linespace),
  $.commit("do").drop(),
  $.drop(linespace),
  () => expression
]).map(match => new PWhile(match[1], match[2], match[0]));

const assignment = $([
  reference,
  $.drop(linespace),
  toSpan(":="),
  $.drop(linespace),
  () => expression
]).map(match => {
  return new PAssignment(match[0], match[2], match[1]);
});

const returnEarly = $([ toSpan("return"), $.drop(linespace), () => expression ]).map(match => {
  return new PReturn(match[1], match[0]);
});

const breakEarly = $([ toSpan("break"), $.drop(linespace), $.optional(() => expression) ]).map(match => {
  return new PBreak(match[1], match[0]);
});

const baseExpression = $.alt(condition, repeatLoop, whileLoop, assignment, returnEarly, breakEarly, func, logical);

export const expression = baseExpression.named("expression");
