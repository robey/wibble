"use strict";

// import $ from "packrattle";
import { cstring } from "../common/strings";
// import { codeBlock } from "./p_code";
// import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan } from "./p_common";
// import { constant } from "./p_const";
// import { compoundType, typedecl } from "./p_type";

/*
 * AST nodes
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

export class PReference extends PExpr {
  constructor(name, span) {
    super(name, span);
    this.name = name;
  }
}

export class PArray extends PExpr {
  // 'trailingComment' is any comment after the final item.
  constructor(children, trailingComment, span) {
    super("array", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

export class PFunction extends PExpr {
  constructor(inType, outType, body, span) {
    super(`function(${inType ? inType.inspect() : "none"} -> ${outType ? outType.inspect() : "none"})`, span, [ body ]);
    this.inType = inType;
    this.outType = outType;
    this.precedence = 100;
  }
}

export class PStructField extends PExpr {
  constructor(name, value, span) {
    super("field" + (name ? `(${name})` : ""), span, [ value ]);
    this.name = name;
  }
}

export class PStruct extends PExpr {
  constructor(children, trailingComment, span) {
    super("struct", span, children);
    this.trailingComment = trailingComment;
    this.precedence = 100;
  }
}

export class PNew extends PExpr {
  constructor(code, span) {
    super("new", span, [ code ]);
    this.precedence = 100;
  }
}

export class PUnary extends PExpr {
  constructor(op, expr, span) {
    super("unary(" + op + ")", span, [ expr ]);
    this.op = op;
    this.precedence = 1;
  }
}

export class PCall extends PExpr {
  constructor(left, right, span) {
    super("call", span, [ left, right ]);
    this.precedence = 2;
  }
}

export class PBinary extends PExpr {
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

export class PIf extends PExpr {
  constructor(condition, onTrue, onFalse, span) {
    super("if", span, (onFalse != null) ? [ condition, onTrue, onFalse ] : [ condition, onTrue ]);
    this.precedence = 9;
  }
}

export class PRepeat extends PExpr {
  constructor(expr, span) {
    super("repeat", span, [ expr ]);
    this.precedence = 9;
  }
}

export class PWhile extends PExpr {
  constructor(condition, expr, span) {
    super("while", span, [ condition, expr ]);
    this.precedence = 9;
  }
}

export class PAssignment extends PExpr {
  constructor(name, expr, span) {
    super("assign", span, [ name, expr ]);
    this.precedence = 10;
  }
}

export class PReturn extends PExpr {
  constructor(expr, span) {
    super("return", span, [ expr ]);
  }
}

export class PBreak extends PExpr {
  constructor(expr, span) {
    super("break", span, expr ? [ expr ] : null);
  }
}

export class PLocal extends PExpr {
  constructor(name, expr) {
    super("local", name.span, [ name, expr ]);
  }
}

export class PLocals extends PExpr {
  constructor(span, locals, mutable) {
    super(mutable ? "make" : "let", span, locals);
    this.mutable = mutable;
  }
}

export class POn extends PExpr {
  constructor(receiver, expr, span) {
    super("on", span, [ receiver, expr ]);
  }
}

export class PBlock extends PExpr {
  constructor(codes, trailingComment, span) {
    super("block", span, codes);
    this.trailingComment = trailingComment;
  }
}
