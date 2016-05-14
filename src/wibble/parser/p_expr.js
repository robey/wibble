"use strict";

import $ from "packrattle";
import { cstring } from "../common/strings";
import { func } from "./p_code";
import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan, whitespace } from "./p_common";
import { constant } from "./p_const";

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
  }
}

class PStructField extends PExpr {
  constructor(fieldName, value, span) {
    super("field" + (fieldName ? `(${fieldName})` : ""), span, [ value ]);
    this.fieldName = fieldName;
  }
}

class PStruct extends PExpr {
  constructor(children, trailingComment, span) {
    super("struct", span, children);
    this.trailingComment = trailingComment;
  }
}

class PNew extends PExpr {
  constructor(code, span) {
    super("new", span, [ code ]);
    this.code = code;
  }
}

class PUnary extends PExpr {
  constructor(op, expr, span) {
    super("unary(" + op + ")", span, [ expr ]);
    this.op = op;
  }
}

class PCall extends PExpr {
  constructor(left, right, span) {
    super("call", span, [ left, right ]);
  }
}

class PBinary extends PExpr {
  constructor(left, op, right, span) {
    super("binary(" + op + ")", span, [ left, right ]);
    this.op = op;
  }
}

class PIf extends PExpr {
  constructor(condition, onTrue, onFalse, span) {
    super("if", span, (onFalse != null) ? [ condition, onTrue, onFalse ] : [ condition, onTrue ]);
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
  whitespace,
  codeBlock
]).map(([ state, code ]) => new PNew(code, state));

const atom = $.alt(
  constant,
  reference,
  xarray,
  () => func,
  struct //,
  /* codeBlock */
  // newObject
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
const logical = binary(comparison, $.alt("and", "or"));

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

const baseExpression = $.alt(condition, logical);

// FIXME
const codeBlock = constant;
newObject;

export const expression = baseExpression.named("expression");
// $([
//   baseExpression,
//   // pr([ linespace, pr.alt(postfixUnless, postfixUntil) ]).optional([]) ]).describe("expression").onMatch (m, state) ->
// ]).map((match, state) => {
//   // pass thru raw expression if there were no postfixes
//   if (m[1].length == 0 then return m[0]
//   // m[1][0].nested = m[0]
//   // m[1][0]
// });
