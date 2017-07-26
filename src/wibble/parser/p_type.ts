import { alt, optional, Parser, seq2, seq3, seq4, seq5, Token } from "packrattle";
import {
  PCompoundType,
  PConstant,
  PEmptyType,
  PFunctionType,
  PInlineType,
  PInlineTypeDeclaration,
  PMergedType,
  PNestedType,
  PNode,
  PNodeToken,
  PParameterType,
  PSimpleType,
  PTemplateType,
  PType,
  PTypedField
} from "../common/ast";
import { symbolRef } from "./p_const";
import { failWithPriority, linespace, linespaceAround, repeatSeparated, repeatSurrounded } from "./p_parser";
import { IDENTIFIER_LIKE, tokenizer, TokenType } from "./p_tokens";
import { expression, reference } from "./p_expr";

/*
 * parse type declarations.
 */

const ReservedError = "Reserved word can't be used as identifier";
const UppercaseError = "Type name must start with uppercase letter";

export const emptyType = tokenizer.match(TokenType.NOTHING).map(token => new PEmptyType(token));

export const simpleType = alt(
  tokenizer.match(TokenType.AT),
  ...IDENTIFIER_LIKE.map(t => tokenizer.match(t))
).named("type name").map(token => {
  if (token.tokenType.id != TokenType.AT) {
    if (token.tokenType.id != TokenType.IDENTIFIER) throw failWithPriority(ReservedError);
    if (!token.value.match(/^[A-Z]/)) throw failWithPriority(UppercaseError);
  }
  return new PSimpleType(token);
});

const typedField: Parser<Token, PTypedField> = seq4(
  () => reference,
  linespaceAround(tokenizer.match(TokenType.COLON)),
  () => typedecl,
  optional(seq2(linespaceAround(tokenizer.match(TokenType.BIND)), () => expression))
).map(([ name, colon, type, value ]) => {
  if (value === undefined) {
    return new PTypedField(name.token, colon.map(t => new PNodeToken(t)), type);
  } else {
    const [ bind, defaultValue ] = value;
    return new PTypedField(
      name.token,
      colon.map(t => new PNodeToken(t)),
      type,
      bind.map(t => new PNodeToken(t)),
      defaultValue
    );
  }
});

export const compoundType = repeatSurrounded(
  TokenType.OPAREN,
  typedField,
  TokenType.COMMA,
  TokenType.CPAREN,
  "type field"
).map(items => {
  return new PCompoundType(items);
});

const templateType = seq2(
  simpleType,
  repeatSurrounded(
    TokenType.OPAREN,
    () => typedecl,
    TokenType.COMMA,
    TokenType.CPAREN,
    "type"
  )
).map(([ name, items ]) => new PTemplateType(name.token, items));

const parameterType = seq2(tokenizer.match(TokenType.DOLLAR), simpleType).map(([ dollar, name ]) => {
  return new PParameterType(dollar, name.token);
})

// just a type with () around it, for precedence
const nestedType = seq5(
  tokenizer.match(TokenType.OPAREN),
  linespace,
  () => typedecl,
  linespace,
  tokenizer.match(TokenType.CPAREN),
).map(([ open, gap1, inner, gap2, close ]) => new PNestedType(open, gap1, inner, gap2, close));

const declaration = seq5(
  alt<Token, PConstant | PType>(symbolRef, compoundType),
  linespace,
  tokenizer.match(TokenType.ARROW),
  linespace,
  () => typedecl
).map(([ argType, gap1, arrow, gap2, resultType ]) => {
  return new PInlineTypeDeclaration(argType, gap1, arrow, gap2, resultType);
});

const inlineType = repeatSurrounded(
  TokenType.OBRACE,
  declaration,
  TokenType.SEMICOLON,
  TokenType.CBRACE,
  "type declaration"
).map(items => {
  return new PInlineType(items);
})

const componentType: Parser<Token, PType> = alt<Token, PType>(
  emptyType,
  inlineType,
  nestedType,
  parameterType,
  templateType,
  simpleType,
  compoundType
);

const functionType = seq3(
  componentType,
  linespaceAround(tokenizer.match(TokenType.ARROW)),
  () => typedecl
).map(([ left, arrow, right ]) => {
  return new PFunctionType(left, arrow, right);
});

const baseType: Parser<Token, PType> = alt(functionType, componentType);

const mergedType = repeatSeparated(baseType, TokenType.PIPE).map(items => {
  if (items.length == 1) return items[0].item;
  return new PMergedType(items);
});

export const typedecl = mergedType.named("type");
