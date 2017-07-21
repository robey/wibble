import { mergeSpan, Token } from "packrattle";
import { AnnotatedItem, HasValue, PNode, PNodeType, Source, sourceToCode, TokenCollection } from "./ast_core";
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
  nodeType = PNodeType.CONSTANT;

  value: string;

  constructor(public type: PConstantType, public source: Source, value?: string) {
    super(
      `const(${PConstantType[type]}, ${value !== undefined ? value : sourceToCode(source)})`
    );
    this.value = value !== undefined ? value : sourceToCode(source);
  }
}

export class PReference extends PNode {
  nodeType = PNodeType.REFERENCE;

  constructor(public token: Token) {
    super(token.value);
    this.source.push(token);
  }
}

export class PArray extends PNode {
  nodeType = PNodeType.ARRAY;

  constructor(public items: TokenCollection<PNode>) {
    super("array", items.list.map(x => x.item));
    this.source = items.source;
  }
}

export class PFunction extends PNode {
  nodeType = PNodeType.FUNCTION;

  constructor(
    public argType: PType | undefined,
    public gap1: Token[],
    public resultType: PType | undefined,
    public gap2: Token[],
    public body: PNode
  ) {
    super(
      "function",
      argType !== undefined ?
        (resultType !== undefined ? [ body, argType, resultType ] : [ body, argType ]) :
        [ body ]
    );
    if (argType !== undefined) this.source.push(argType);
    this.source = this.source.concat(gap1);
    if (resultType !== undefined) this.source.push(resultType);
    this.source = this.source.concat(gap2);
    this.source.push(body);
  }
}

export class PStructField extends PNode {
  nodeType = PNodeType.STRUCT_FIELD;

  constructor(public name: PReference | undefined, public gap: Token[], public value: PNode) {
    super(
      name === undefined ? "field" : `field(${name.token.value})`,
      [ value ]
    );
    if (name !== undefined) this.source.push(name);
    this.source = this.source.concat(gap, value);
  }
}

export class PStruct extends PNode {
  nodeType = PNodeType.STRUCT;

  constructor(public items: TokenCollection<PStructField>) {
    super("struct", items.list.map(x => x.item));
    this.source = items.source;
  }
}

export class PNested extends PNode {
  nodeType = PNodeType.NESTED;

  constructor(
    public open: HasValue,
    public gap1: Token[],
    public inner: PNode,
    public gap2: Token[],
    public close: HasValue
  ) {
    super("nested", [ inner ]);
    this.source = this.source.concat(open, gap1, inner, gap2, close);
  }
}

export class PNew extends PNode {
  nodeType = PNodeType.NEW;

  constructor(
    public token: Token,
    public gap1: Token | undefined,
    public type: PType | undefined,
    public gap2: Token | undefined,
    public code: PNode
  ) {
    super("new", type === undefined ? [ code ] : [ code, type ]);
    this.source.push(token);
    if (gap1 !== undefined) this.source.push(gap1);
    if (type !== undefined) this.source.push(type);
    if (gap2 !== undefined) this.source.push(gap2);
    this.source.push(code);
  }
}

export class PUnary extends PNode {
  nodeType = PNodeType.UNARY;

  constructor(public op: Token, public gap: Token | undefined, public expr: PNode) {
    super(`unary(${op.value})`, [ expr ]);
    this.source.push(op);
    if (gap !== undefined) this.source.push(gap);
    this.source.push(expr);
  }
}

export class PCall extends PNode {
  nodeType = PNodeType.CALL;

  constructor(public left: PNode, public gap: HasValue | undefined, public right: PNode) {
    super("call", [ left, right ]);
    this.source.push(left);
    if (gap !== undefined) this.source.push(gap);
    this.source.push(right);
  }
}

export class PBinary extends PNode {
  nodeType = PNodeType.BINARY;

  constructor(
    public left: PNode,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    public right: PNode
  ) {
    super(`binary(${op.value})`, [ left, right ]);
    this.source.push(left);
    if (gap1 !== undefined) this.source.push(gap1);
    this.source = this.source.concat(op, gap2, right);
  }
}

// added by the desugar phase to mark nodes where shortcut-logic should apply (and, or).
export class PLogic extends PNode {
  nodeType = PNodeType.LOGIC;

  constructor(
    public left: PNode,
    public gap1: Token | undefined,
    public op: Token,
    public gap2: Token[],
    public right: PNode
  ) {
    super(`logic(${op.value})`, [ left, right ]);
    this.source.push(left);
    if (gap1 !== undefined) this.source.push(gap1);
    this.source = this.source.concat(op, gap2, right);
  }
}

export class PIf extends PNode {
  nodeType = PNodeType.IF;

  constructor(
    public ifToken: Token[],
    public condition: PNode,
    public thenToken: Token[],
    public onTrue: PNode,
    public elseToken: Token[],
    public onFalse?: PNode
  ) {
    super("if", onFalse === undefined ? [ condition, onTrue ] : [ condition, onTrue, onFalse ]);
    this.source = this.source.concat(ifToken, condition, thenToken, onTrue, elseToken);
    if (onFalse !== undefined) this.source.push(onFalse);
  }
}

export class PRepeat extends PNode {
  nodeType = PNodeType.REPEAT;

  constructor(public token: Token, public gap: Token | undefined, public expr: PNode) {
    super("repeat", [ expr ]);
    this.source.push(token);
    if (gap !== undefined) this.source.push(gap);
    this.source.push(expr);
  }
}

export class PWhile extends PNode {
  nodeType = PNodeType.WHILE;

  constructor(
    public token1: Token,
    public gap1: Token | undefined,
    public condition: PNode,
    public gap2: Token | undefined,
    public token2: Token,
    public gap3: Token | undefined,
    public expr: PNode
  ) {
    super("while", [ condition, expr ]);
    this.source.push(token1);
    if (gap1 !== undefined) this.source.push(gap1);
    this.source.push(condition);
    if (gap2 !== undefined) this.source.push(gap2);
    this.source.push(token2);
    if (gap3 !== undefined) this.source.push(gap3);
    this.source.push(expr);
  }
}

export class PAssignment extends PNode {
  nodeType = PNodeType.ASSIGNMENT;

  constructor(public name: PNode, public assign: Token[], public expr: PNode) {
    super("assign", [ name, expr ]);
    this.source = this.source.concat(name, assign, expr);
  }
}

export class PReturn extends PNode {
  nodeType = PNodeType.RETURN;

  constructor(public tokens: Token[], public expr: PNode) {
    super("return", [ expr ]);
    this.source = this.source.concat(tokens, expr);
  }
}

export class PBreak extends PNode {
  nodeType = PNodeType.BREAK;

  constructor(public tokens: Token[], public expr?: PNode) {
    super("break", (expr === undefined) ? [] : [ expr ]);
    this.source = this.source.concat(tokens);
    if (expr !== undefined) this.source.push(expr);
  }
}

export class PLocal extends PNode {
  nodeType = PNodeType.LOCAL;

  constructor(
    public isVar: Token[],
    public name: PReference,
    public tokens: Token[],
    public expr: PNode
  ) {
    super(`local${isVar.length == 0 ? "" : "-var"}(${name.token.value})`, [ expr ]);
    this.source = this.source.concat(isVar, name, tokens, expr);
  }
}

export class PLocals extends PNode {
  nodeType = PNodeType.LOCALS;

  constructor(public tokens: Token[], public locals: AnnotatedItem<PLocal>[]) {
    super("let", locals.map(x => x.item));
    this.source = this.source.concat(tokens, locals);
  }
}

export class POn extends PNode {
  nodeType = PNodeType.ON;

  constructor(
    public onTokens: Token[],
    public receiver: PNode,
    public typeTokens: Token[],
    public type: PNode | undefined,
    public arrowTokens: Token[],
    public expr: PNode
  ) {
    super("on", type === undefined ? [ receiver, expr ] : [ receiver, expr, type ]);
    this.source = this.source.concat(onTokens, receiver, typeTokens);
    if (type !== undefined) this.source.push(type);
    this.source = this.source.concat(arrowTokens, expr);
  }
}

export class PBlock extends PNode {
  nodeType = PNodeType.BLOCK;

  constructor(public code: TokenCollection<PNode>) {
    super("block", code.list.map(x => x.item));
    this.source = code.source;
  }
}
