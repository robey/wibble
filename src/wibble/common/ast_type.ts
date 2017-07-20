import { mergeSpan, Span, Token } from "packrattle";
import { AnnotatedItem, PNode, Source, TokenCollection } from "./ast_core";
import { PConstant } from "./ast_expr";

export class PType extends PNode {
  constructor(description: string, children?: PNode[]) {
    super(description, children);
  }
}

export class PEmptyType extends PType {
  constructor(public token: Token) {
    super("emptyType");
    this.source.push(token);
  }
}

export class PSimpleType extends PType {
  constructor(public token: Token) {
    super(`type(${token.value})`);
    this.source.push(token);
  }
}

// used only in compound types: a field name with an optional type and optional default value.
export class PTypedField extends PNode {
  constructor(
    public name: Token,
    public colon: Token[],
    public type: PType,
    public bind: Token[] = [],
    public defaultValue?: PNode,
  ) {
    super(`field(${name.value})`, defaultValue === undefined ? [ type ] : [ type, defaultValue ]);
    this.source = this.source.concat(name, colon, type, bind);
    if (defaultValue !== undefined) this.source.push(defaultValue);
  }
}

export class PCompoundType extends PType {
  constructor(public fields: TokenCollection<PTypedField>) {
    super("compoundType", fields.list.map(x => x.item));
    this.source = fields.source;
  }
}

export class PTemplateType extends PType {
  constructor(public name: PSimpleType, public params: TokenCollection<PType>) {
    super(`templateType(${name.token.value})`, params.list.map(x => x.item));
    this.source = this.source.concat(name, params.source);
  }
}

export class PParameterType extends PType {
  constructor(public dollar: Token, public name: PSimpleType) {
    super(`parameterType(${name.token.value})`);
    this.source.push(dollar);
    this.source.push(name);
  }
}

export class PFunctionType extends PType {
  constructor(public argType: PType, public arrow: Token[], public resultType: PType) {
    super("functionType", [ argType, resultType ]);
    this.source = this.source.concat(argType, arrow, resultType);
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
    super("nestedType", [ inner ]);
    this.source.push(open);
    if (gap1 !== undefined) this.source.push(gap1);
    this.source.push(inner);
    if (gap2 !== undefined) this.source.push(gap2);
    this.source.push(close);
  }
}

export class PMergedType extends PType {
  constructor(public types: AnnotatedItem<PType>[]) {
    super("mergedType", types.map(x => x.item));
    this.source = types;
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
    super("inlineTypeDeclaration", [ argType, resultType ]);
    this.source.push(argType);
    if (gap1 !== undefined) this.source.push(gap1);
    this.source.push(arrow);
    if (gap2 !== undefined) this.source.push(gap2);
    this.source.push(resultType);
  }
}

export class PInlineType extends PType {
  constructor(public declarations: TokenCollection<PInlineTypeDeclaration>) {
    super("inlineType", declarations.list.map(x => x.item));
    this.source = declarations.source;
  }
}
