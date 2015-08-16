"use strict";

import $ from "packrattle";
import { cstring } from "../common/util";
import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan, whitespace } from "./p_common";
import { constant } from "./p_const";

/*
 * parse expressions
 */

class PExpr {
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
    if (this.comment) rv += "#\"" + util.cstring(this.comment) + "\"";
    if (this.trailingComment) rv += "##\"" + util.cstring(this.trailingComment) + "\"";
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


// ----- parsers

const reference = $(p_common.SYMBOL_NAME).filter(match => !p_common.isReserved(match[0])).map((match, span) => {
  return new PReference(match[0], span);
});

const xarray = p_common.repeatSurrounded(
  $.commit("["),
  () => expression,
  /[\n,]+/,
  $.commit("]"),
  p_common.commentspace,
  "array items"
).map(([ items, comment ], span) => {
  return new PArray(items, comment, span);
}).named("array");

const structMember = $([
  $.optional([ p_common.SYMBOL_NAME, p_common.linespace, "=", p_common.linespace ], []),
  () => expression
]).map(([ prefix, value ], span) => {
  return new PStructField(prefix.length > 0 ? prefix[0][0] : null, value, span);
});

const struct = p_common.repeatSurrounded(
  $.commit("("),
  structMember,
  /[\n,]+/,
  ")",
  p_common.commentspace,
  "struct member"
).map(([ items, comment ], span) => {
  // AST optimization: "(expr)" is just a precedence-bumped expression.
  if (items.length == 1 && !items[0].fieldname) return items[0].children[0];
  return new PStruct(items, comment, span);
}).named("struct");

const newObject = $([
  p_common.toSpan("new"),
  p_common.whitespace,
  codeBlock
]).map(([ state, code ]) => new PNew(code, state));

const atom = $.alt(
  p_const.constant,
  reference,
  xarray,
  /* xfunction */
  struct //,
  /* codeBlock */
  // newObject
).named("atom");

// FIXME
const codeBlock = p_const.constant;

const expression = atom.named("expression");
// $([
//   baseExpression,
//   // pr([ linespace, pr.alt(postfixUnless, postfixUntil) ]).optional([]) ]).describe("expression").onMatch (m, state) ->
// ]).map((match, state) => {
//   // pass thru raw expression if there were no postfixes
//   if (m[1].length == 0 then return m[0]
//   // m[1][0].nested = m[0]
//   // m[1][0]
// });
exports.expression = expression;
