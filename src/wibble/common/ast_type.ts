import { Token } from "packrattle";
import { AnnotatedItem, PExpr, PType, PTypeKind, TokenCollection } from "./ast_core";
import { PConstant } from "./ast_expr";


export class PEmptyType extends PType {
  constructor(public token: Token) {
    super(PTypeKind.EMPTY_TYPE, "emptyType", [ token ]);
  }
}

export class PSimpleType extends PType {
  constructor(public token: Token) {
    super(PTypeKind.SIMPLE_TYPE, `type(${token.value})`, [ token ]);
  }
}

// used only in compound types: a field name with an optional type and optional default value.
export class PTypedField extends PType {
  constructor(
    name: Token,
    colon: Token[],
    type: PType,
    bind: Token[] = [],
    defaultValue?: PExpr,
  ) {
    super(PTypeKind.TYPED_FIELD, `field(${name.value})`, [ name, colon, type, bind, defaultValue ]);
  }
}

export class PCompoundType extends PType {
  constructor(fields: TokenCollection<PTypedField>) {
    super(PTypeKind.COMPOUND_TYPE, "compoundType", [ fields ]);
  }
}

export class PTemplateType extends PType {
  constructor(name: Token, params: TokenCollection<PType>) {
    super(PTypeKind.TEMPLATE_TYPE, `templateType(${name.value})`, [ name, params ]);
  }
}

export class PParameterType extends PType {
  constructor(dollar: Token, name: Token) {
    super(PTypeKind.PARAMETER_TYPE, `parameterType(${name.value})`, [ dollar, name ]);
  }
}

export class PFunctionType extends PType {
  constructor(argType: PType, arrow: Token[], resultType: PType) {
    super(PTypeKind.FUNCTION_TYPE, "functionType", [ argType, arrow, resultType ]);
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
    super(PTypeKind.NESTED_TYPE, "nestedType", [ open, gap1, inner, gap2, close ]);
  }
}

export class PMergedType extends PType {
  constructor(types: AnnotatedItem<PType>[]) {
    super(PTypeKind.MERGED_TYPE, "mergedType", types);
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
    super(PTypeKind.INLINE_TYPE_DECLARATION, "inlineTypeDeclaration", [ argType, gap1, arrow, gap2, resultType ]);
  }
}

export class PInlineType extends PType {
  constructor(public declarations: TokenCollection<PInlineTypeDeclaration>) {
    super(PTypeKind.INLINE_TYPE, "inlineType", [ declarations ]);
  }
}
