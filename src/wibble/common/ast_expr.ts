import { mergeSpan, Token } from "packrattle";
import { AnnotatedItem, PNode, PNodeExpr, PNodeType, TokenCollection } from "./ast_core";
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

export class PConstant extends PNodeExpr {
  value: string;

  constructor(public type: PConstantType, tokens: PNode[], value?: string) {
    super(
      PNodeType.CONSTANT,
      `const(${PConstantType[type]}, ${value !== undefined ? value : tokens.map(x => x.source).join("")})`,
      tokens
    );
    this.value = value !== undefined ? value : tokens.map(x => x.source).join("");
  }
}

export class PReference extends PNodeExpr {
  constructor(public token: Token) {
    super(PNodeType.REFERENCE, token.value, token);
  }
}

export class PArray extends PNodeExpr {
  constructor(items: TokenCollection<PNodeExpr>) {
    super(PNodeType.ARRAY, "array", items);
  }
}

export class PFunction extends PNodeExpr {
  constructor(
    argType: PType | undefined,
    gap1: Token[],
    resultType: PType | undefined,
    gap2: Token[],
    body: PNodeExpr
  ) {
    super(PNodeType.FUNCTION, "function", argType, gap1, resultType, gap2, body);
  }
}

export class PStructField extends PNodeExpr {
  constructor(name: Token | undefined, gap: Token[], value: PNodeExpr) {
    super(PNodeType.STRUCT_FIELD, name === undefined ? "field" : `field(${name.value})`, name, gap, value);
  }
}

export class PStruct extends PNodeExpr {
  constructor(items: TokenCollection<PStructField>) {
    super(PNodeType.STRUCT, "struct", items);
  }
}

export class PNested extends PNodeExpr {
  constructor(
    open: PNode,
    gap1: Token[],
    inner: PNode,
    gap2: Token[],
    close: PNode
  ) {
    super(PNodeType.NESTED, "nested", open, gap1, inner, gap2, close);
  }
}

export class PNew extends PNodeExpr {
  constructor(
    public token: Token,
    public gap1: Token | undefined,
    public type: PType | undefined,
    public gap2: Token | undefined,
    public code: PNodeExpr
  ) {
    super(PNodeType.NEW, "new", token, gap1, type, gap2, code);
  }
}

export class PUnary extends PNodeExpr {
  constructor(public op: Token, gap: Token | undefined, expr: PNodeExpr) {
    super(PNodeType.UNARY, `unary(${op.value})`, op, gap, expr);
  }
}

export class PCall extends PNodeExpr {
  constructor(left: PNodeExpr, gap: PNode | undefined, right: PNodeExpr) {
    super(PNodeType.CALL, "call", left, gap, right);
  }
}

export class PBinary extends PNodeExpr {
  constructor(
    left: PNode,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    right: PNode
  ) {
    super(PNodeType.BINARY, `binary(${op.value})`, left, gap1, op, gap2, right);
  }
}

// added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
export class PLogic extends PNodeExpr {
  constructor(
    left: PNode,
    gap1: Token | undefined,
    public op: Token,
    gap2: Token[],
    right: PNode
  ) {
    super(PNodeType.LOGIC, `logic(${op.value})`, left, gap1, op, gap2, right);
  }
}

export class PIf extends PNodeExpr {
  constructor(
    ifToken: Token[],
    condition: PNode,
    thenToken: Token[],
    onTrue: PNode,
    elseToken: Token[],
    onFalse?: PNode
  ) {
    super(PNodeType.IF, "if", ifToken, condition, thenToken, onTrue, elseToken, onFalse);
  }
}

export class PRepeat extends PNodeExpr {
  constructor(token: Token, gap: Token | undefined, expr: PNode) {
    super(PNodeType.REPEAT, "repeat", token, gap, expr);
  }
}

export class PWhile extends PNodeExpr {
  constructor(
    token1: Token,
    gap1: Token | undefined,
    condition: PNode,
    gap2: Token | undefined,
    token2: Token,
    gap3: Token | undefined,
    expr: PNode
  ) {
    super(PNodeType.WHILE, "while", token1, gap1, condition, gap2, token2, gap3, expr);
  }
}

export class PAssignment extends PNodeExpr {
  constructor(name: PNode, assign: Token[], expr: PNode) {
    super(PNodeType.ASSIGNMENT, "assign", name, assign, expr);
  }
}

export class PReturn extends PNodeExpr {
  constructor(tokens: Token[], expr: PNode) {
    super(PNodeType.RETURN, "return", tokens, expr);
  }
}

export class PBreak extends PNodeExpr {
  constructor(tokens: Token[], expr?: PNode) {
    super(PNodeType.BREAK, "break", tokens, expr);
  }
}

export class PLocal extends PNodeExpr {
  constructor(
    isVar: Token[],
    name: Token,
    tokens: Token[],
    expr: PNode
  ) {
    super(
      PNodeType.LOCAL,
      `local${isVar.length == 0 ? "" : "-var"}(${name.value})`,
      isVar, name, tokens, expr
    );
  }
}

export class PLocals extends PNodeExpr {
  constructor(token: Token, gap: Token | undefined, locals: AnnotatedItem<PLocal>[]) {
    super(PNodeType.LOCALS, "let", token, gap, locals);
  }
}

export class POn extends PNodeExpr {
  constructor(
    onTokens: Token[],
    receiver: PNode,
    typeTokens: Token[],
    type: PNode | undefined,
    arrowTokens: Token[],
    expr: PNode
  ) {
    super(PNodeType.ON, "on", onTokens, receiver, typeTokens, type, arrowTokens, expr);
  }
}

export class PBlock extends PNodeExpr {
  constructor(code: TokenCollection<PNodeExpr>) {
    super(PNodeType.BLOCK, "block", code);
  }
}
