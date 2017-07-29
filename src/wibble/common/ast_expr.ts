import { mergeSpan, Token } from "packrattle";
import { AnnotatedItem, PExpr, PExprKind, PType, TokenCollection } from "./ast_core";
import { TokenType } from "./tokens";

export enum PConstantType {
  NOTHING,
  BOOLEAN,
  SYMBOL,
  NUMBER_BASE2,
  NUMBER_BASE10,
  NUMBER_BASE16,
  STRING
}

export class PConstant extends PExpr {
  value: string;

  constructor(public type: PConstantType, tokens: Token[], value?: string) {
    super(
      PExprKind.CONSTANT,
      `const(${PConstantType[type]}, ${value !== undefined ? value : tokens.map(x => x.value).join("")})`,
      tokens
    );
    this.value = value !== undefined ? value : tokens.map(x => x.value).join("");
  }
}

export class PReference extends PExpr {
  constructor(public token: Token) {
    super(
      PExprKind.REFERENCE,
      token.tokenType.id == TokenType.IDENTIFIER ? token.value : token.value.slice(1, -1),
      token
    );
  }
}

export class PArray extends PExpr {
  constructor(items: TokenCollection<PExpr>) {
    super(PExprKind.ARRAY, "array", items);
  }
}

export class PFunction extends PExpr {
  constructor(
    public inType: PType | undefined,
    space1: Token | undefined,
    colon: Token | undefined,
    space2: Token | undefined,
    public outType: PType | undefined,
    space3: Token | undefined,
    arrow: Token,
    space4: Token | undefined,
    body: PExpr
  ) {
    super(PExprKind.FUNCTION, "function", inType, space1, colon, space2, outType, space3, arrow, space4, body);
  }
}

export class PStructField extends PExpr {
  constructor(public name: Token | undefined, public gap: Token[], value: PExpr) {
    super(PExprKind.STRUCT_FIELD, name === undefined ? "field" : `field(${name.value})`, name, gap, value);
  }
}

export class PStruct extends PExpr {
  constructor(public items: TokenCollection<PStructField>) {
    super(PExprKind.STRUCT, "struct", items);
  }
}

export class PNested extends PExpr {
  constructor(
    open: Token,
    gap1: Token[],
    inner: PExpr,
    gap2: Token[],
    close: Token
  ) {
    super(PExprKind.NESTED, "nested", open, gap1, inner, gap2, close);
  }
}

export class PNew extends PExpr {
  constructor(
    public token: Token,
    public gap1: Token | undefined,
    type: PType | undefined,
    public gap2: Token | undefined,
    code: PExpr
  ) {
    super(PExprKind.NEW, "new", token, gap1, type, gap2, code);
  }
}

export class PUnary extends PExpr {
  constructor(public op: Token, gap: Token | undefined, expr: PExpr) {
    super(PExprKind.UNARY, `unary(${op.value})`, op, gap, expr);
  }
}

export class PCall extends PExpr {
  constructor(left: PExpr, gap: Token | undefined, right: PExpr) {
    super(PExprKind.CALL, "call", left, gap, right);
  }
}

export class PBinary extends PExpr {
  constructor(
    left: PExpr,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    right: PExpr
  ) {
    super(PExprKind.BINARY, `binary(${op.value})`, left, gap1, op, gap2, right);
  }
}

// added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
export class PLogic extends PExpr {
  constructor(
    left: PExpr,
    gap1: Token | undefined,
    public op: Token,
    gap2: Token[],
    right: PExpr
  ) {
    super(PExprKind.LOGIC, `logic(${op.value})`, left, gap1, op, gap2, right);
  }
}

export class PIf extends PExpr {
  constructor(
    public ifToken: Token,
    public space1: Token | undefined,
    condition: PExpr,
    public space2: Token | undefined,
    public thenToken: Token,
    public space3: Token | undefined,
    onTrue: PExpr,
    public space4?: Token,
    public elseToken?: Token,
    public space5?: Token,
    onFalse?: PExpr
  ) {
    super(
      PExprKind.IF, "if", ifToken, space1, condition, space2, thenToken, space3, onTrue, space4, elseToken,
      space5, onFalse
    );
  }
}

export class PRepeat extends PExpr {
  constructor(token: Token, gap: Token | undefined, expr: PExpr) {
    super(PExprKind.REPEAT, "repeat", token, gap, expr);
  }
}

export class PWhile extends PExpr {
  constructor(
    token1: Token,
    gap1: Token | undefined,
    condition: PExpr,
    gap2: Token | undefined,
    token2: Token,
    gap3: Token | undefined,
    expr: PExpr
  ) {
    super(PExprKind.WHILE, "while", token1, gap1, condition, gap2, token2, gap3, expr);
  }
}

export class PAssignment extends PExpr {
  constructor(name: PReference, space1: Token | undefined, assign: Token, space2: Token | undefined, expr: PExpr) {
    super(PExprKind.ASSIGNMENT, "assign", name, space1, assign, space2, expr);
  }
}

export class PReturn extends PExpr {
  constructor(token: Token, gap: Token | undefined, expr: PExpr) {
    super(PExprKind.RETURN, "return", token, gap, expr);
  }
}

export class PBreak extends PExpr {
  constructor(token: Token, gap?: Token, expr?: PExpr) {
    super(PExprKind.BREAK, "break", token, gap, expr);
  }
}

export class PLocal extends PExpr {
  constructor(
    isVar: Token | undefined,
    space1: Token | undefined,
    name: Token,
    space2: Token | undefined,
    token: Token,
    space3: Token | undefined,
    expr: PExpr
  ) {
    super(
      PExprKind.LOCAL,
      `local${isVar === undefined ? "" : "-var"}(${name.value})`,
      isVar, space1, name, space2, token, space3, expr
    );
  }
}

export class PLocals extends PExpr {
  constructor(token: Token, gap: Token | undefined, locals: AnnotatedItem<PLocal>[]) {
    super(PExprKind.LOCALS, "let", token, gap, locals);
  }
}

export class POn extends PExpr {
  constructor(
    onToken: Token,
    space1: Token | undefined,
    receiver: PConstant | PType,
    colon: Token | undefined,
    space2: Token | undefined,
    type: PType | undefined,
    space3: Token | undefined,
    arrow: Token,
    space4: Token | undefined,
    expr: PExpr
  ) {
    super(PExprKind.ON, "on", onToken, space1, receiver, colon, space2, type, space3, arrow, space4, expr);
  }
}

export class PBlock extends PExpr {
  constructor(code: TokenCollection<PExpr>) {
    super(PExprKind.BLOCK, "block", code);
  }
}
