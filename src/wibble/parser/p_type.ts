import { alt, optional, Parser, seq2, seq4, Token } from "packrattle";
import { PCompoundType, PNode, PSimpleType, PType, PTypedField } from "../common/ast";
import { failWithPriority, linespace, linespaceAround, repeatSurrounded } from "./p_parser";
import { IDENTIFIER_LIKE, tokenizer, TokenType } from "./p_tokens";
import { expression, reference } from "./p_expr";

/*
 * parse type declarations.
 */

const ReservedError = "Reserved word can't be used as identifier";
const UppercaseError = "Type name must start with uppercase letter";

export const simpleType = alt(
  tokenizer.match(TokenType.AT),
  ...IDENTIFIER_LIKE.map(t => tokenizer.match(t))
).named("type name").map(token => {
  if (token.tokenType.id != TokenType.AT) {
    if (token.tokenType.id != TokenType.IDENTIFIER) throw failWithPriority(ReservedError);
    if (!token.value.match(/^[A-Z]/)) throw failWithPriority(UppercaseError);
  }
  return new PSimpleType(token.value, token.span);
});

const typedField: Parser<Token, PTypedField> = seq4(
  () => reference,
  linespaceAround(tokenizer.match(TokenType.COLON)),
  () => typedecl,
  optional(seq2(linespaceAround(tokenizer.match(TokenType.BIND)), () => expression))
).map(([ name, colon, type, value ]) => {
  if (value === undefined) {
    return new PTypedField(name.name, colon, type, name.span);
  } else {
    const [ bind, defaultValue ] = value;
    return new PTypedField(name.name, colon, type, name.span, bind, defaultValue);
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

// const templateType = $([
//   $(TYPE_NAME).map(match => match[0]),
//   repeatSurrounded("(", () => typedecl, ",", ")", $.drop(linespace), "type")
// ]).map((match, span) => {
//   return new PTemplateType(match[0], match[1][0], span);
// });
//
// const parameterType = $([ $.drop("$"), $(TYPE_NAME).map(match => match[0]) ]).map((match, span) => {
//   return new PParameterType(match[0], span);
// });
//
// const nestedType = $([ $.drop("("), () => typedecl, $.drop(")") ]).map(match => match[0]);
//
// const declaration = $([
//   $.alt(symbolRef, compoundType),
//   $.drop(linespace),
//   $.drop("->"),
//   $.drop(linespace),
//   () => typedecl
// ]).map((match, span) => {
//   return new PInlineTypeDeclaration(match[0], match[1], span);
// });
//
// const inlineType = repeatSurrounded(
//   "{",
//   declaration,
//   lf,
//   "}",
//   commentspace,
//   "type declaration"
// ).map((match, span) => {
//   return new PInlineType(match[0], match[1], span);
// });
//
// const componentType = $.alt(inlineType, nestedType, parameterType, templateType, simpleType, compoundType);
const componentType: Parser<Token, PType> = alt<Token, PType>(simpleType, compoundType);

// const functionType = $([
//   componentType,
//   $.drop(linespace),
//   $.commit("->").drop(),
//   $.drop(linespace),
//   () => typedecl
// ]).map((match, span) => {
//   return new PFunctionType(match[0], match[1], span);
// }).or(componentType);
//
// const mergedType  = repeatSeparated(
//   functionType,
//   $.drop("|"),
//   $.drop(linespace)
// ).map((match, span) => {
//   if (match.length == 1) return match[0];
//   return new PMergedType(match, span);
// });
//
// export const typedecl = mergedType.named("type");

// FIXME
export const typedecl = componentType.named("type");
