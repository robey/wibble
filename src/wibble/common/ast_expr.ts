import { mergeSpan, Token } from "packrattle";
import { AnnotatedItem, PChildNode, PNode, PNodeType, sourceCode, TokenCollection } from "./ast_core";
import { PType } from "./ast_type";

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

  constructor(public type: PConstantType, public source: PChildNode[], value?: string) {
    super(
      PNodeType.CONSTANT,
      `const(${PConstantType[type]}, ${value !== undefined ? value : sourceCode(source)})`,
      source
    );
    this.value = value !== undefined ? value : sourceCode(source);
  }
}

export class PReference extends PNode {
  constructor(public token: Token) {
    super(PNodeType.REFERENCE, token.value, token);
  }
}

export class PArray extends PNode {
  constructor(public items: TokenCollection<PNode>) {
    super(PNodeType.ARRAY, "array", items);
  }
}

export class PFunction extends PNode {
  constructor(
    public argType: PType | undefined,
    public gap1: Token[],
    public resultType: PType | undefined,
    public gap2: Token[],
    public body: PNode
  ) {
    super(PNodeType.FUNCTION, "function", argType, gap1, resultType, gap2, body);
  }
}

export class PStructField extends PNode {
  constructor(public name: PReference | undefined, public gap: Token[], public value: PNode) {
    super(PNodeType.STRUCT_FIELD, name === undefined ? "field" : `field(${name.token.value})`, name, gap, value);
  }
}

export class PStruct extends PNode {
  constructor(public items: TokenCollection<PStructField>) {
    super(PNodeType.STRUCT, "struct", items);
  }
}

export class PNested extends PNode {
  constructor(
    public open: PChildNode,
    public gap1: Token[],
    public inner: PNode,
    public gap2: Token[],
    public close: PChildNode
  ) {
    super(PNodeType.NESTED, "nested", open, gap1, inner, gap2, close);
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
    super(PNodeType.NEW, "new", token, gap1, type, gap2, code);
  }
}

export class PUnary extends PNode {
  constructor(public op: Token, public gap: Token | undefined, public expr: PNode) {
    super(PNodeType.UNARY, `unary(${op.value})`, op, gap, expr);
  }
}

export class PCall extends PNode {
  constructor(public left: PNode, public gap: PChildNode | undefined, public right: PNode) {
    super(PNodeType.CALL, "call", left, gap, right);
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
    super(PNodeType.BINARY, `binary(${op.value})`, left, gap1, op, gap2, right);
  }
}

// added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
export class PLogic extends PNode {
  constructor(
    public left: PNode,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    public right: PNode
  ) {
    super(PNodeType.LOGIC, `logic(${op.value})`, left, gap1, op, gap2, right);
  }
}

export class PIf extends PNode {
  constructor(
    public ifToken: Token[],
    public condition: PNode,
    public thenToken: Token[],
    public onTrue: PNode,
    public elseToken: Token[],
    public onFalse?: PNode
  ) {
    super(PNodeType.IF, "if", ifToken, condition, thenToken, onTrue, elseToken, onFalse);
  }
}

export class PRepeat extends PNode {
  constructor(public token: Token, public gap: Token | undefined, public expr: PNode) {
    super(PNodeType.REPEAT, "repeat", token, gap, expr);
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
    super(PNodeType.WHILE, "while", token1, gap1, condition, gap2, token2, gap3, expr);
  }
}

export class PAssignment extends PNode {
  constructor(public name: PNode, public assign: Token[], public expr: PNode) {
    super(PNodeType.ASSIGNMENT, "assign", name, assign, expr);
  }
}

export class PReturn extends PNode {
  constructor(public tokens: Token[], public expr: PNode) {
    super(PNodeType.RETURN, "return", tokens, expr);
  }
}

export class PBreak extends PNode {
  constructor(public tokens: Token[], public expr?: PNode) {
    super(PNodeType.BREAK, "break", tokens, expr);
  }
}

export class PLocal extends PNode {
  constructor(
    public isVar: Token[],
    public name: PReference,
    public tokens: Token[],
    public expr: PNode
  ) {
    super(
      PNodeType.LOCAL,
      `local${isVar.length == 0 ? "" : "-var"}(${name.token.value})`,
      isVar, name, tokens, expr
    );
  }
}

export class PLocals extends PNode {
  constructor(public tokens: Token[], public locals: AnnotatedItem<PLocal>[]) {
    super(PNodeType.LOCALS, "let", locals);
  }
}

export class POn extends PNode {
  constructor(
    public onTokens: Token[],
    public receiver: PNode,
    public typeTokens: Token[],
    public type: PNode | undefined,
    public arrowTokens: Token[],
    public expr: PNode
  ) {
    super(PNodeType.ON, "on", onTokens, receiver, typeTokens, type, arrowTokens, expr);
  }
}

export class PBlock extends PNode {
  constructor(public code: TokenCollection<PNode>) {
    super(PNodeType.BLOCK, "block", code);
  }
}
