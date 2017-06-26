// import Enum from "./enum";
// import { cstring } from "./strings";

import { mergeSpan, Span, Token } from "packrattle";

// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNode> {
  constructor(
    public item: A,
    public gap1: Token | undefined,
    public separator: Token | undefined,
    public gap2: Token[]
  ) {
    // pass
  }

  toCode(): string {
    return this.item.toCode() +
      (this.gap1 ? this.gap1.value : "") +
      (this.separator ? this.separator.value : "") +
      this.gap2.map(t => t.value).join("");
  }
}

export class TokenCollection<A extends PNode> {
  constructor(
    public open: Token,
    public gap1: Token[],
    public list: AnnotatedItem<A>[],
    public gap2: Token[],
    public close: Token
  ) {
    // pass
  }

  toCode(): string {
    return this.open.value +
      this.gap1.map(t => t.value).join("") +
      this.list.map(item => item.toCode()).join("") +
      this.gap2.map(t => t.value).join("") +
      this.close.value;
  }
}

/*
 * AST nodes
 */

// export const OPERATOR_PRECEDENCE = {
//   // 1: unary
//   // 2: call
//   "**": 3,
//   "*": 4,
//   "/": 4,
//   "%": 4,
//   "+": 5,
//   "-": 5,
//   "<": 6,
//   ">": 6,
//   "==": 6,
//   "!=": 6,
//   "<=": 6,
//   ">=": 6,
//   "and": 7,
//   "or": 8
// };

export class PNode {
  public precedence = 1;
  public parent?: PNode;

  constructor(public description: string, public span: Span, public children: PNode[] = []) {
    this.children = this.children.filter(c => c != null);
    this.children.forEach(c => {
      c.parent = this;
    });
//     // other common fields: comment, trailingComment
  }

//   get nodeType() {
//     return this.constructor.name;
//   }

  inspect(dump: boolean = false): string {
    if (dump) return this.dump().join("\n");

    let rv = this.description;
    if (this.children.length > 0) {
      rv += "{ " + this.children.map(c => c.inspect()).join(", ") + " }";
    }
    // if (this.comment) rv += "#\"" + cstring(this.comment) + "\"";
    // if (this.trailingComment) rv += "##\"" + cstring(this.trailingComment) + "\"";
    // generated nodes may have no span.
    if (this.span) rv += "[" + this.span.start + ":" + this.span.end + "]";
    return rv;
  }

  dump(): string[] {
    const rv = [ this.description ];
    // if (this.scope) rv.push("scope=" + this.scope.inspect());
    // if (this.computedType) rv.push("type=" + this.computedType.inspect());
    // if (this.newType) rv.push("newType=" + this.newType.inspect());
    const children = this.children.map(c => c.dump());
    children.forEach((lines, i) => {
      const [ branch, tail ] = (i == children.length - 1) ? [ "`-", "  " ] : [ "|-", "| " ];
      rv.push(branch + lines[0]);
      lines.slice(1).forEach(line => rv.push(tail + line));
    });
    return rv;
  }

  toCode(): string {
    return "";
  }
}

export enum PConstantType {
  NOTHING,
  BOOLEAN,
  SYMBOL,
  NUMBER_BASE2,
  NUMBER_BASE10,
  NUMBER_BASE16,
  STRING
}

export class PConstant extends PNode {
  constructor(public type: PConstantType, public value: string, span: Span) {
    super(
      type == PConstantType.NOTHING ? "const(NOTHING)" : `const(${PConstantType[type]}, ${value})`,
      span
    );
  }

  toCode(): string {
    return this.value;
  }
}

export class PReference extends PNode {
  constructor(public name: string, span: Span) {
    super(name, span);
  }

  toCode(): string {
    return this.name;
  }
}

export class PArray extends PNode {
  // 'trailingComment' is any comment after the final item.
  constructor(public items: TokenCollection<PNode>) {
    super("array", mergeSpan(items.open.span, items.close.span), items.list.map(x => x.item));
    this.precedence = 100;
  }

  toCode(): string {
    return this.items.toCode();
  }
}

// // inType, body, [outType]
// export class PFunction extends PNode {
//   constructor(inType, outType, body, span) {
//     super("function", span, [ inType || NO_IN_TYPE, body, outType ]);
//     this.inType = inType;
//     this.outType = outType;
//     this.precedence = 100;
//   }
// }
//
// export class PStructField extends PNode {
//   constructor(name, value, span) {
//     super("field" + (name ? `(${name})` : ""), span, [ value ]);
//     this.name = name;
//   }
// }
//
// export class PStruct extends PNode {
//   constructor(children, trailingComment, span) {
//     super("struct", span, children);
//     this.trailingComment = trailingComment;
//     this.precedence = 100;
//   }
// }
//
// export class PNew extends PNode {
//   constructor(code, type, span) {
//     super("new", span, [ code, type ]);
//     this.precedence = 100;
//   }
// }
//
// export class PUnary extends PNode {
//   constructor(op, expr, span) {
//     super("unary(" + op + ")", span, [ expr ]);
//     this.op = op;
//     this.precedence = 1;
//   }
// }
//
// export class PCall extends PNode {
//   constructor(left, right, span) {
//     super("call", span, [ left, right ]);
//     this.precedence = 2;
//   }
// }
//
// export class PBinary extends PNode {
//   constructor(left, op, right, span) {
//     super("binary(" + op + ")", span, [ left, right ]);
//     this.op = op;
//     this.precedence = OPERATOR_PRECEDENCE[op];
//     if (!this.precedence) throw new Error("No precedence for " + op);
//   }
// }
//
// // added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
// export class PLogic extends PNode {
//   constructor(left, op, right, span) {
//     super("logic(" + op + ")", span, [ left, right ]);
//     this.op = op;
//     this.precedence = OPERATOR_PRECEDENCE[op];
//     if (!this.precedence) throw new Error("No precedence for " + op);
//   }
// }
//
// export class PIf extends PNode {
//   constructor(condition, onTrue, onFalse, span) {
//     super("if", span, (onFalse != null) ? [ condition, onTrue, onFalse ] : [ condition, onTrue ]);
//     this.precedence = 9;
//   }
// }
//
// export class PRepeat extends PNode {
//   constructor(expr, span) {
//     super("repeat", span, [ expr ]);
//     this.precedence = 9;
//   }
// }
//
// export class PWhile extends PNode {
//   constructor(condition, expr, span) {
//     super("while", span, [ condition, expr ]);
//     this.precedence = 9;
//   }
// }
//
// export class PAssignment extends PNode {
//   constructor(name, expr, span) {
//     super("assign", span, [ name, expr ]);
//     this.precedence = 10;
//   }
// }
//
// export class PReturn extends PNode {
//   constructor(expr, span) {
//     super("return", span, [ expr ]);
//   }
// }
//
// export class PBreak extends PNode {
//   constructor(expr, span) {
//     super("break", span, expr ? [ expr ] : null);
//   }
// }
//
// export class PLocal extends PNode {
//   constructor(name, expr, span, mutable) {
//     super(`local(${name})`, span, [ expr ]);
//     this.name = name;
//     // redundant but handy to have nearby:
//     this.mutable = mutable;
//   }
// }
//
// export class PLocals extends PNode {
//   constructor(span, locals, mutable) {
//     super(mutable ? "make" : "let", span, locals);
//     this.mutable = mutable;
//   }
// }
//
// export class POn extends PNode {
//   constructor(receiver, expr, outType, span) {
//     super("on", span, [ receiver, expr, outType ]);
//     this.precedence = 100;
//   }
// }
//
// export class PBlock extends PNode {
//   constructor(codes, trailingComment, span) {
//     super("block", span, codes);
//     this.trailingComment = trailingComment;
//   }
// }


// ----- types

export class PType extends PNode {
  constructor(description: string, span: Span, children?: PNode[]) {
    super(description, span, children);
  }
}

export class PSimpleType extends PType {
  constructor(public name: string, span: Span) {
    super(`type(${name})`, span);
  }

  toCode(): string {
    return this.name;
  }
}

// used only in compound types: a field name with an optional type and optional default value.
export class PTypedField extends PNode {
  constructor(
    public name: string,
    public colon: Token[],
    public type: PType,
    span: Span,
    public bind?: Token[],
    public defaultValue?: PNode,
  ) {
    super(`field(${name})`, span, defaultValue ? [ type, defaultValue ] : [ type ]);
  }

  toCode(): string {
    let rv = this.name + this.colon.map(t => t.value).join("") + this.type.toCode();
    if (this.bind && this.defaultValue) rv += this.bind.map(t => t.value).join("") + this.defaultValue.toCode();
    return rv;
  }
}

export class PCompoundType extends PType {
  constructor(public fields: TokenCollection<PTypedField>) {
    super("compoundType", mergeSpan(fields.open.span, fields.close.span), fields.list.map(x => x.item));
  }

  toCode(): string {
    return this.fields.toCode();
  }
}

// export class PTemplateType extends PType {
//   constructor(name, params, span) {
//     super(`templateType(${name})`, span, params);
//     this.name = name;
//   }
// }
//
// export class PParameterType extends PType {
//   constructor(name, span) {
//     super(`parameterType(${name})`, span);
//     this.name = name;
//   }
// }
//
// export class PFunctionType extends PType {
//   constructor(argType, resultType, span) {
//     super("functionType", span, [ argType, resultType ]);
//     this.argType = argType;
//     this.resultType = resultType;
//     this.precedence = 2;
//   }
// }
//
// export class PMergedType extends PType {
//   constructor(types, span) {
//     super("mergedType", span, types);
//     this.precedence = 3;
//   }
// }
//
// export class PInlineTypeDeclaration extends PType {
//   constructor(guard, type, span) {
//     super("inlineTypeDeclaration", span, [ guard, type ]);
//   }
// }
//
// export class PInlineType extends PType {
//   constructor(declarations, trailingComment, span) {
//     super("inlineType", span, declarations);
//     this.trailingComment = trailingComment;
//   }
// }
//
// const NO_IN_TYPE = new PCompoundType([]);
