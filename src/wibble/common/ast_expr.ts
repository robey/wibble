import { mergeSpan, Token } from "packrattle";
import { AnnotatedItem, PExprKind, PNode, PNodeExpr, PType, TokenCollection } from "./ast_core";

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
      PExprKind.CONSTANT,
      `const(${PConstantType[type]}, ${value !== undefined ? value : tokens.map(x => x.source).join("")})`,
      tokens
    );
    this.value = value !== undefined ? value : tokens.map(x => x.source).join("");
  }
}

export class PReference extends PNodeExpr {
  constructor(public token: PNode) {
    super(PExprKind.REFERENCE, token.source, token);
  }
}

export class PArray extends PNodeExpr {
  constructor(items: TokenCollection<PNodeExpr>) {
    super(PExprKind.ARRAY, "array", items);
  }
}

export class PFunction extends PNodeExpr {
  constructor(
    public inType: PType | undefined,
    space1: PNode | undefined,
    colon: PNode | undefined,
    space2: PNode | undefined,
    public outType: PType | undefined,
    space3: PNode | undefined,
    arrow: PNode,
    space4: PNode | undefined,
    body: PNodeExpr
  ) {
    super(PExprKind.FUNCTION, "function", inType, space1, colon, space2, outType, space3, arrow, space4, body);
  }
}

export class PStructField extends PNodeExpr {
  constructor(public name: PNode | undefined, public gap: PNode[], value: PNodeExpr) {
    super(PExprKind.STRUCT_FIELD, name === undefined ? "field" : `field(${name.source})`, name, gap, value);
  }
}

export class PStruct extends PNodeExpr {
  constructor(public items: TokenCollection<PStructField>) {
    super(PExprKind.STRUCT, "struct", items);
  }
}

export class PNested extends PNodeExpr {
  constructor(
    open: PNode,
    gap1: PNode[],
    inner: PNode,
    gap2: PNode[],
    close: PNode
  ) {
    super(PExprKind.NESTED, "nested", open, gap1, inner, gap2, close);
  }
}

export class PNew extends PNodeExpr {
  constructor(
    public token: PNode,
    public gap1: PNode | undefined,
    type: PType | undefined,
    public gap2: PNode | undefined,
    code: PNodeExpr
  ) {
    super(PExprKind.NEW, "new", token, gap1, type, gap2, code);
  }
}

export class PUnary extends PNodeExpr {
  constructor(public op: PNode, gap: PNode | undefined, expr: PNodeExpr) {
    super(PExprKind.UNARY, `unary(${op.source})`, op, gap, expr);
  }
}

export class PCall extends PNodeExpr {
  constructor(left: PNodeExpr, gap: PNode | undefined, right: PNodeExpr) {
    super(PExprKind.CALL, "call", left, gap, right);
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
    super(PExprKind.BINARY, `binary(${op.value})`, left, gap1, op, gap2, right);
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
    super(PExprKind.LOGIC, `logic(${op.value})`, left, gap1, op, gap2, right);
  }
}

export class PIf extends PNodeExpr {
  constructor(
    public ifToken: PNode,
    public space1: PNode | undefined,
    condition: PNodeExpr,
    public space2: PNode | undefined,
    public thenToken: PNode,
    public space3: PNode | undefined,
    onTrue: PNodeExpr,
    public space4?: PNode,
    public elseToken?: PNode,
    public space5?: PNode,
    onFalse?: PNodeExpr
  ) {
    super(
      PExprKind.IF, "if", ifToken, space1, condition, space2, thenToken, space3, onTrue, space4, elseToken,
      space5, onFalse
    );
  }
}

export class PRepeat extends PNodeExpr {
  constructor(token: PNode, gap: PNode | undefined, expr: PNodeExpr) {
    super(PExprKind.REPEAT, "repeat", token, gap, expr);
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
    super(PExprKind.WHILE, "while", token1, gap1, condition, gap2, token2, gap3, expr);
  }
}

export class PAssignment extends PNodeExpr {
  constructor(name: PNode, space1: PNode | undefined, assign: PNode, space2: PNode | undefined, expr: PNodeExpr) {
    super(PExprKind.ASSIGNMENT, "assign", name, space1, assign, space2, expr);
  }
}

export class PReturn extends PNodeExpr {
  constructor(token: PNode, gap: PNode | undefined, expr: PNodeExpr) {
    super(PExprKind.RETURN, "return", token, gap, expr);
  }
}

export class PBreak extends PNodeExpr {
  constructor(token: PNode, gap?: PNode, expr?: PNodeExpr) {
    super(PExprKind.BREAK, "break", token, gap, expr);
  }
}

export class PLocal extends PNodeExpr {
  constructor(
    isVar: PNode | undefined,
    space1: PNode | undefined,
    name: PNode,
    space2: PNode | undefined,
    token: PNode,
    space3: PNode | undefined,
    expr: PNodeExpr
  ) {
    super(
      PExprKind.LOCAL,
      `local${isVar === undefined ? "" : "-var"}(${name.source})`,
      isVar, space1, name, space2, token, space3, expr
    );
  }
}

export class PLocals extends PNodeExpr {
  constructor(token: PNode, gap: PNode | undefined, locals: AnnotatedItem<PLocal>[]) {
    super(PExprKind.LOCALS, "let", token, gap, locals);
  }
}

export class POn extends PNodeExpr {
  constructor(
    onToken: PNode,
    space1: PNode | undefined,
    receiver: PConstant | PType,
    colon: PNode | undefined,
    space2: PNode | undefined,
    type: PType | undefined,
    space3: PNode | undefined,
    arrow: PNode,
    space4: PNode | undefined,
    expr: PNodeExpr
  ) {
    super(PExprKind.ON, "on", onToken, space1, receiver, colon, space2, type, space3, arrow, space4, expr);
  }
}

export class PBlock extends PNodeExpr {
  constructor(code: TokenCollection<PNodeExpr>) {
    super(PExprKind.BLOCK, "block", code);
  }
}
