import { mergeSpan, Span, Token } from "packrattle";
import { AnnotatedItem, ImplicitChildNode, PNode, PNodeType, TokenCollection } from "./ast_core";
import { PConstant } from "./ast_expr";

export class PType extends PNode {
  constructor(nodeType: PNodeType, description: string, ...children: ImplicitChildNode[]) {
    super(nodeType, description, ...children);
  }
}

export class PEmptyType extends PType {
  constructor(public token: Token) {
    super(PNodeType.EMPTY_TYPE, "emptyType", token);
  }
}

export class PSimpleType extends PType {
  constructor(public token: Token) {
    super(PNodeType.SIMPLE_TYPE, `type(${token.value})`, token);
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
    super(PNodeType.TYPED_FIELD, `field(${name.value})`, name, colon, type, bind, defaultValue);
  }
}

export class PCompoundType extends PType {
  constructor(public fields: TokenCollection<PTypedField>) {
    super(PNodeType.COMPOUND_TYPE, "compoundType", fields);
  }
}

export class PTemplateType extends PType {
  constructor(public name: PSimpleType, public params: TokenCollection<PType>) {
    super(PNodeType.TEMPLATE_TYPE, `templateType(${name.token.value})`, name, params);
  }
}

export class PParameterType extends PType {
  constructor(public dollar: Token, public name: PSimpleType) {
    super(PNodeType.PARAMETER_TYPE, `parameterType(${name.token.value})`, dollar, name);
  }
}

export class PFunctionType extends PType {
  constructor(public argType: PType, public arrow: Token[], public resultType: PType) {
    super(PNodeType.FUNCTION_TYPE, "functionType", argType, arrow, resultType);
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
    super(PNodeType.NESTED_TYPE, "nestedType", open, gap1, inner, gap2, close);
  }
}

export class PMergedType extends PType {
  constructor(public types: AnnotatedItem<PType>[]) {
    super(PNodeType.MERGED_TYPE, "mergedType", types);
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
    super(PNodeType.INLINE_TYPE_DECLARATION, "inlineTypeDeclaration", argType, gap1, arrow, gap2, resultType);
  }
}

export class PInlineType extends PType {
  constructor(public declarations: TokenCollection<PInlineTypeDeclaration>) {
    super(PNodeType.INLINE_TYPE, "inlineType", declarations);
  }
}
