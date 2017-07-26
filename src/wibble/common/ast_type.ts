import { mergeSpan, Span, Token } from "packrattle";
import { AnnotatedItem, ImplicitNode, PNodeExpr, PNodeType, TokenCollection } from "./ast_core";
import { PConstant } from "./ast_expr";

export class PType extends PNodeExpr {
  constructor(nodeType: PNodeType, description: string, ...children: ImplicitNode[]) {
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
export class PTypedField extends PNodeExpr {
  constructor(
    name: Token,
    colon: Token[],
    type: PType,
    bind: Token[] = [],
    defaultValue?: PNodeExpr,
  ) {
    super(PNodeType.TYPED_FIELD, `field(${name.value})`, name, colon, type, bind, defaultValue);
  }
}

export class PCompoundType extends PType {
  constructor(fields: TokenCollection<PTypedField>) {
    super(PNodeType.COMPOUND_TYPE, "compoundType", fields);
  }
}

export class PTemplateType extends PType {
  constructor(name: Token, params: TokenCollection<PType>) {
    super(PNodeType.TEMPLATE_TYPE, `templateType(${name.value})`, name, params);
  }
}

export class PParameterType extends PType {
  constructor(dollar: Token, name: Token) {
    super(PNodeType.PARAMETER_TYPE, `parameterType(${name.value})`, dollar, name);
  }
}

export class PFunctionType extends PType {
  constructor(argType: PType, arrow: Token[], resultType: PType) {
    super(PNodeType.FUNCTION_TYPE, "functionType", argType, arrow, resultType);
  }
}

export class PNestedType extends PType {
  constructor(
    open: Token,
    gap1: Token | undefined,
    inner: PType,
    gap2: Token | undefined,
    close: Token
  ) {
    super(PNodeType.NESTED_TYPE, "nestedType", open, gap1, inner, gap2, close);
  }
}

export class PMergedType extends PType {
  constructor(types: AnnotatedItem<PType>[]) {
    super(PNodeType.MERGED_TYPE, "mergedType", types);
  }
}

export class PInlineTypeDeclaration extends PType {
  constructor(
    argType: PConstant | PType,
    gap1: Token | undefined,
    arrow: Token,
    gap2: Token | undefined,
    resultType: PType
  ) {
    super(PNodeType.INLINE_TYPE_DECLARATION, "inlineTypeDeclaration", argType, gap1, arrow, gap2, resultType);
  }
}

export class PInlineType extends PType {
  constructor(public declarations: TokenCollection<PInlineTypeDeclaration>) {
    super(PNodeType.INLINE_TYPE, "inlineType", declarations);
  }
}
