"use strict";

import Enum from "./enum";
import { cstring } from "./strings";

/*
 * AST nodes
 */

export const OPERATOR_PRECEDENCE = {
  // 1: unary
  // 2: call
  "**": 3,
  "*": 4,
  "/": 4,
  "%": 4,
  "+": 5,
  "-": 5,
  "<": 6,
  ">": 6,
  "==": 6,
  "!=": 6,
  "<=": 6,
  ">=": 6,
  "and": 7,
  "or": 8
};

export class PNode {
  constructor(description, span, children) {
    this.description = description;
    this.span = span;
    this.children = (children || []).filter(c => c != null);
    this.precedence = 1;
    // other common fields: comment, trailingComment
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

export const PConstantType = new Enum([
  "NOTHING",
  "BOOLEAN",
  "SYMBOL",
  "NUMBER_BASE10",
  "NUMBER_BASE16",
  "NUMBER_BASE2",
  "STRING"
]);

export class PConstant extends PNode {
  constructor(type, value, span) {
    super(
      type == PConstantType.NOTHING ? "const(NOTHING)" : `const(${PConstantType.name(type)}, ${value})`,
      span
    );
    this.type = type;
    this.value = value;
  }
}

export class PReference extends PNode {
  constructor(name, span) {
    super(name, span);
    this.name = name;
  }
}

export class PArray extends PNode {
  // 'trailingComment' is any comment after the final item.
  constructor(children, trailingComment, span) {
    super("array", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

export class PFunction extends PNode {
  constructor(inType, outType, body, span) {
    super(`function(${inType ? inType.inspect() : "none"} -> ${outType ? outType.inspect() : "none"})`, span, [ body ]);
    this.inType = inType;
    this.outType = outType;
    this.precedence = 100;
  }
}

export class PStructField extends PNode {
  constructor(name, value, span) {
    super("field" + (name ? `(${name})` : ""), span, [ value ]);
    this.name = name;
  }
}

export class PStruct extends PNode {
  constructor(children, trailingComment, span) {
    super("struct", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

export class PNew extends PNode {
  constructor(code, span) {
    super("new", span, [ code ]);
    this.precedence = 100;
  }
}

export class PUnary extends PNode {
  constructor(op, expr, span) {
    super("unary(" + op + ")", span, [ expr ]);
    this.op = op;
    this.precedence = 1;
  }
}

export class PCall extends PNode {
  constructor(left, right, span) {
    super("call", span, [ left, right ]);
    this.precedence = 2;
  }
}

export class PBinary extends PNode {
  constructor(left, op, right, span) {
    super("binary(" + op + ")", span, [ left, right ]);
    this.op = op;
    this.precedence = OPERATOR_PRECEDENCE[op];
    if (!this.precedence) throw new Error("No precedence for " + op);
  }
}

// added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
export class PLogic extends PNode {
  constructor(left, op, right, span) {
    super("logic(" + op + ")", span, [ left, right ]);
    this.op = op;
    this.precedence = OPERATOR_PRECEDENCE[op];
    if (!this.precedence) throw new Error("No precedence for " + op);
  }
}

export class PIf extends PNode {
  constructor(condition, onTrue, onFalse, span) {
    super("if", span, (onFalse != null) ? [ condition, onTrue, onFalse ] : [ condition, onTrue ]);
    this.precedence = 9;
  }
}

export class PRepeat extends PNode {
  constructor(expr, span) {
    super("repeat", span, [ expr ]);
    this.precedence = 9;
  }
}

export class PWhile extends PNode {
  constructor(condition, expr, span) {
    super("while", span, [ condition, expr ]);
    this.precedence = 9;
  }
}

export class PAssignment extends PNode {
  constructor(name, expr, span) {
    super("assign", span, [ name, expr ]);
    this.precedence = 10;
  }
}

export class PReturn extends PNode {
  constructor(expr, span) {
    super("return", span, [ expr ]);
  }
}

export class PBreak extends PNode {
  constructor(expr, span) {
    super("break", span, expr ? [ expr ] : null);
  }
}

export class PLocal extends PNode {
  constructor(name, expr) {
    super("local", name.span, [ name, expr ]);
  }
}

export class PLocals extends PNode {
  constructor(span, locals, mutable) {
    super(mutable ? "make" : "let", span, locals);
    this.mutable = mutable;
  }
}

export class POn extends PNode {
  constructor(receiver, expr, span) {
    super("on", span, [ receiver, expr ]);
  }
}

export class PBlock extends PNode {
  constructor(codes, trailingComment, span) {
    super("block", span, codes);
    this.trailingComment = trailingComment;
  }
}


// ----- types

export class PType extends PNode {
  constructor(description, span, children) {
    super(description, span, children);
  }
}

export class PSimpleType extends PType {
  constructor(name, span) {
    super(`type(${name})`, span);
    this.name = name;
  }
}

// used only in compound types: a field name with an optional type and optional default value.
export class PTypedField extends PNode {
  constructor(name, type, defaultValue, span) {
    super(`field(${name})`, span, [ type, defaultValue ]);
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
  }
}

export class PCompoundType extends PType {
  constructor(fields, span) {
    super("compoundType", span, fields);
  }
}

export class PTemplateType extends PType {
  constructor(name, params, span) {
    super(`templateType(${name})`, span, params);
    this.name = name;
  }
}

export class PParameterType extends PType {
  constructor(name, span) {
    super(`parameterType(${name})`, span);
    this.name = name;
  }
}

export class PFunctionType extends PType {
  constructor(argType, resultType, span) {
    super("functionType", span, [ argType, resultType ]);
    this.argType = argType;
    this.resultType = resultType;
    this.precedence = 2;
  }
}

export class PDisjointType extends PType {
  constructor(types, span) {
    super("disjointType", span, types);
    this.precedence = 3;
  }
}


// export function transformAst(node) {
//
// }

// # traverse an expression tree, sending each expression object through the
// # 'transform' function before diving deeper.
// # transform(expr, state) -> [ newExpr, newState ]
// digExpr = (expr, state, transform) ->
//   dig = (e) -> digExpr(e, state, transform)
