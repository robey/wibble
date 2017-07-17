import { mergeSpan, Span, Token } from "packrattle";
import { cstring } from "./strings";

// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNode> {
  span: Span;

  constructor(
    public item: A,
    public gap1: Token | undefined,
    public separator: Token | undefined,
    public gap2: Token[]
  ) {
    let lastSpan = this.item.span;
    if (this.gap1 !== undefined) lastSpan = this.gap1.span;
    if (this.separator !== undefined) lastSpan = this.separator.span;
    if (this.gap2.length > 0) lastSpan = this.gap2[this.gap2.length - 1].span;
    this.span = mergeSpan(this.item.span, lastSpan);
  }

  toString(): string {
    return this.toCode();
  }

  toCode(): string {
    return this.item.toCode() +
      (this.gap1 ? this.gap1.value : "") +
      (this.separator ? this.separator.value : "") +
      this.gap2.map(t => t.value).join("");
  }
}

export class TokenCollection<A extends PNode> {
  span: Span;

  constructor(
    public open: Token,
    public gap1: Token[],
    public list: AnnotatedItem<A>[],
    public gap2: Token[],
    public close: Token
  ) {
    this.span = mergeSpan(open.span, close.span);
  }

  toString(): string {
    return this.toCode();
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

export const OPERATOR_PRECEDENCE: { [key: string]: number } = {
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

  toString(): string {
    return this.inspect();
  }

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
  value: string;

  constructor(public type: PConstantType, public tokens: Token[], value?: string) {
    super(
      `const(${PConstantType[type]}, ${value !== undefined ? value : tokens.map(t => t.value).join("")})`,
      mergeSpan(tokens[0].span, tokens[tokens.length - 1].span)
    );
    this.value = value !== undefined ? value : tokens.map(t => t.value).join("");
  }

  toCode(): string {
    return this.tokens.map(t => t.value).join("");
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
  constructor(public items: TokenCollection<PNode>) {
    super("array", mergeSpan(items.open.span, items.close.span), items.list.map(x => x.item));
    this.precedence = 100;
  }

  toCode(): string {
    return this.items.toCode();
  }
}

export class PFunction extends PNode {
  constructor(
    public argType: PType | undefined,
    public gap1: Token[],
    public resultType: PType | undefined,
    public gap2: Token[],
    public body: PNode,
    span: Span
  ) {
    super(
      "function",
      span,
      argType !== undefined ?
        (resultType !== undefined ? [ body, argType, resultType ] : [ body, argType ]) :
        [ body ]
    );
    this.precedence = 100;
  }

  toCode(): string {
    return (this.argType !== undefined ? this.argType.toCode() : "") +
      this.gap1.map(t => t.value).join("") +
      (this.resultType !== undefined ? this.resultType.toCode() : "") +
      this.gap2.map(t => t.value).join("") +
      this.body.toCode();
  }
}

export class PStructField extends PNode {
  constructor(public name: PReference | undefined, public gap: Token[], public value: PNode) {
    super(
      name === undefined ? "field" : `field(${name.name})`,
      name === undefined ? value.span : mergeSpan(name.span, value.span),
      [ value ]
    );
  }

  toCode(): string {
    return (this.name !== undefined ? this.name.toCode() : "") +
      this.gap.map(t => t.value).join("") +
      this.value.toCode();
  }
}

export class PStruct extends PNode {
  constructor(public items: TokenCollection<PStructField>) {
    super("struct", mergeSpan(items.open.span, items.close.span), items.list.map(x => x.item));
    this.precedence = 100;
  }

  toCode(): string {
    return this.items.toCode();
  }
}

export class PNested extends PNode {
  constructor(
    public open: Token,
    public gap1: Token[],
    public inner: PNode,
    public gap2: Token[],
    public close: Token
  ) {
    super("nested", mergeSpan(open.span, close.span), [ inner ]);
  }

  toCode(): string {
    return this.open.value +
      this.gap1.map(t => t.value).join("") +
      this.inner.toCode() +
      this.gap2.map(t => t.value).join("") +
      this.close.value;
  }
}

export class PNew extends PNode {
  constructor(
    public token: Token,
    public gap1: Token | undefined,
    public type: PType | undefined,
    public gap2: Token | undefined,
    public code: PNode
  ) {
    super("new", token.span, type === undefined ? [ code ] : [ code, type ]);
    this.precedence = 100;
  }

  toCode(): string {
    return this.token.value +
      (this.gap1 === undefined ? "" : this.gap1.value) +
      (this.type === undefined ? "" : this.type.toCode()) +
      (this.gap2 === undefined ? "" : this.gap2.value) +
      this.code.toCode();
  }
}

export class PUnary extends PNode {
  constructor(public op: Token, public gap: Token | undefined, public expr: PNode) {
    super(`unary(${op.value})`, op.span, [ expr ]);
  }

  toCode(): string {
    return this.op.value + (this.gap === undefined ? "" : this.gap.value) + this.expr.toCode();
  }
}

export class PCall extends PNode {
  constructor(public left: PNode, public gap: Token | undefined, public right: PNode) {
    super("call", mergeSpan(left.span, right.span), [ left, right ]);
    this.precedence = 2;
  }

  toCode(): string {
    return this.left.toCode() + (this.gap === undefined ? "" : this.gap.value) + this.right.toCode();
  }
}

export class PBinary extends PNode {
  constructor(
    public left: PNode,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    public right: PNode
  ) {
    super(`binary(${op.value})`, op.span, [ left, right ]);
    this.precedence = OPERATOR_PRECEDENCE[op.value];
    if (this.precedence === undefined) throw new Error(`No precedence for ${op.value}`);
  }

  toCode(): string {
    return this.left.toCode() +
      (this.gap1 === undefined ? "" : this.gap1.value) +
      this.op.value +
      this.gap2.map(t => t.value).join("") +
      this.right.toCode();
  }
}

// // added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
// export class PLogic extends PNode {
//   constructor(left, op, right, span) {
//     super("logic(" + op + ")", span, [ left, right ]);
//     this.op = op;
//     this.precedence = OPERATOR_PRECEDENCE[op];
//     if (!this.precedence) throw new Error("No precedence for " + op);
//   }
// }

export class PIf extends PNode {
  constructor(
    public gap1: Token[],
    public condition: PNode,
    public gap2: Token[],
    public onTrue: PNode,
    public gap3: Token[],
    public onFalse?: PNode
  ) {
    super("if", gap1[0].span, onFalse === undefined ? [ condition, onTrue ] : [ condition, onTrue, onFalse ]);
    this.precedence = 9;
  }

  toCode(): string {
    return this.gap1.map(t => t.value).join("") +
      this.condition.toCode() +
      this.gap2.map(t => t.value).join("") +
      this.onTrue.toCode() +
      this.gap3.map(t => t.value).join("") +
      (this.onFalse === undefined ? "" : this.onFalse.toCode());
  }
}

export class PRepeat extends PNode {
  constructor(public token: Token, public gap: Token | undefined, public expr: PNode) {
    super("repeat", token.span, [ expr ]);
    this.precedence = 9;
  }

  toCode(): string {
    return this.token.value + (this.gap === undefined ? "" : this.gap.value) + this.expr.toCode();
  }
}

export class PWhile extends PNode {
  constructor(
    public token1: Token,
    public gap1: Token | undefined,
    public condition: PNode,
    public gap2: Token | undefined,
    public token2: Token,
    public gap3: Token | undefined,
    public expr: PNode
  ) {
    super("while", token1.span, [ condition, expr ]);
  }

  toCode(): string {
    return this.token1.value +
      (this.gap1 === undefined ? "" : this.gap1.value) +
      this.condition.toCode() +
      (this.gap2 === undefined ? "" : this.gap2.value) +
      this.token2.value +
      (this.gap3 === undefined ? "" : this.gap3.value) +
      this.expr.toCode();
  }
}

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

export class PBlock extends PNode {
  constructor(public code: TokenCollection<PNode>) {
    super("block", code.span, code.list.map(x => x.item));
  }

  toCode(): string {
    return this.code.toString();
  }
}


// ----- types

export class PType extends PNode {
  constructor(description: string, span: Span, children?: PNode[]) {
    super(description, span, children);
  }
}

export class PEmptyType extends PNode {
  constructor(public token: Token) {
    super("emptyType", token.span);
  }

  toCode(): string {
    return this.token.value;
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
    super("compoundType", fields.span, fields.list.map(x => x.item));
  }

  toCode(): string {
    return this.fields.toCode();
  }
}

export class PTemplateType extends PType {
  constructor(public name: PSimpleType, public params: TokenCollection<PType>) {
    super(`templateType(${name.name})`, mergeSpan(name.span, params.span), params.list.map(x => x.item));
  }

  toCode(): string {
    return this.name.toCode() + this.params.toCode();
  }
}

export class PParameterType extends PType {
  constructor(public dollar: Token, public name: PSimpleType) {
    super(`parameterType(${name.name})`, mergeSpan(dollar.span, name.span));
  }

  toCode(): string {
    return this.dollar.value + this.name.toCode();
  }
}

export class PFunctionType extends PType {
  constructor(public argType: PType, public arrow: Token[], public resultType: PType) {
    super("functionType", mergeSpan(argType.span, resultType.span), [ argType, resultType ]);
    this.precedence = 2;
  }

  toCode(): string {
    return this.argType.toCode() + this.arrow.map(t => t.value).join("") + this.resultType.toCode();
  }
}

export class PNestedType extends PType {
  constructor(
    public open: Token,
    public gap1: Token | undefined,
    public inner: PType,
    public gap2: Token | undefined,
    public close: Token
  ) {
    super("nestedType", mergeSpan(open.span, close.span), [ inner ]);
  }

  toCode(): string {
    return this.open.value +
      (this.gap1 ? this.gap1.value : "") +
      this.inner.toCode() +
      (this.gap2 ? this.gap2.value : "") +
      this.close.value;
  }
}

export class PMergedType extends PType {
  constructor(public types: AnnotatedItem<PType>[]) {
    super("mergedType", mergeSpan(types[0].span, types[types.length - 1].span), types.map(x => x.item));
    this.precedence = 3;
  }

  toCode(): string {
    return this.types.map(x => x.toCode()).join("");
  }
}

export class PInlineTypeDeclaration extends PType {
  constructor(
    public argType: PConstant | PType,
    public gap1: Token | undefined,
    public arrow: Token,
    public gap2: Token | undefined,
    public resultType: PType
  ) {
    super("inlineTypeDeclaration", mergeSpan(argType.span, resultType.span), [ argType, resultType ]);
  }

  toCode(): string {
    return this.argType.toCode() +
      (this.gap1 ? this.gap1.value : "") +
      this.arrow.value +
      (this.gap2 ? this.gap2.value : "") +
      this.resultType.toCode();
  }
}

export class PInlineType extends PType {
  constructor(public declarations: TokenCollection<PInlineTypeDeclaration>) {
    super("inlineType", declarations.span, declarations.list.map(x => x.item));
  }

  toCode(): string {
    return this.declarations.toCode();
  }
}
