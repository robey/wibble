import { alt, optional, Parser, seq2, seq3, seq5, seq6, Token } from "packrattle";
import { PAssignment, PBlock, PBreak, PLocal, PLocals, PNode, PReturn } from "../common/ast";
// import { commentspace, lf, linespace, repeatSeparated, repeatSurrounded, toSpan } from "./p_common";
// import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";
import { linespace, repeatSeparated, repeatSurrounded } from "./p_parser";
// import { compoundType, typedecl } from "./p_type";
import { tokenizer, TokenType } from "./p_tokens";

/*
 * parse expressions which can only be in a code block.
 */

const assignment = seq5(
  reference,
  linespace,
  tokenizer.match(TokenType.ASSIGN),
  linespace,
  () => code
).named("assignment").map(([ name, gap1, token, gap2, expr ]) => {
  const tokens = (gap1 === undefined ? [] : [ gap1 ]).concat(token);
  if (gap2 !== undefined) tokens.push(gap2);
  return new PAssignment(name, tokens, expr);
});

const returnEarly = seq3(
  tokenizer.match(TokenType.RETURN),
  linespace,
  () => code
).named("return").map(([ token, gap, expr ]) => {
  const tokens = [ token ];
  if (gap !== undefined) tokens.push(gap);
  return new PReturn(tokens, expr);
});

const breakEarly = seq2(
  tokenizer.match(TokenType.BREAK),
  optional(seq2(linespace, () => code))
).map(([ token, optionalExpr ]) => {
  const tokens = [ token ];
  if (optionalExpr === undefined) return new PBreak(tokens);
  const [ gap, expr ] = optionalExpr;
  if (gap !== undefined) tokens.push(gap);
  return new PBreak(tokens, expr);
});

const localDeclaration = seq6(
  optional(seq2(tokenizer.match(TokenType.VAR), linespace)),
  reference,
  linespace,
  tokenizer.match(TokenType.BIND),
  linespace,
  () => expression
).map(([ optionalVar, name, gap1, op, gap2, expr ]) => {
  const isVar: Token[] = [];
  if (optionalVar !== undefined) {
    const [ a, b ] = optionalVar;
    isVar.push(a);
    if (b !== undefined) isVar.push(b);
  }
  const tokens = (gap1 === undefined ? [] : [ gap1 ]).concat(op);
  if (gap2 !== undefined) tokens.push(gap2);
  return new PLocal(isVar, name, tokens, expr);
});

const localLet = seq3(
  tokenizer.match(TokenType.LET),
  linespace,
  repeatSeparated(localDeclaration, TokenType.COMMA)
).map(([ token, gap, items ]) => {
  const tokens = [ token ];
  if (gap !== undefined) tokens.push(gap);
  return new PLocals(tokens, items);
})


// function localDeclaration(operator, mutable) {
//   return $([
//     reference.named("identifier"),
//     $.drop(linespace),
//     $.drop(operator),
//     $.drop(linespace),
//     () => expression
//   ]).map(match => {
//     return new PLocal(match[0].name, match[1], match[0].span, mutable);
//   });
// }
//
// const localLet = $([
//   toSpan("let"),
//   $.drop(linespace),
//   repeatSeparated(localDeclaration("=", false), ",", $.drop(linespace))
// ]).map(match => {
//   return new PLocals(match[0], match[1], false);
// });
//
// const localMake = $([
//   toSpan("make"),
//   $.drop(linespace),
//   repeatSeparated(localDeclaration(":=", true), ",", $.drop(linespace))
// ]).map(match => {
//   return new PLocals(match[0], match[1], true);
// });
//
// const handlerReceiver = $.alt(symbolRef, compoundType).named("symbol or parameters");
// const handler = $([
//   toSpan("on"),
//   $.drop(linespace),
//   handlerReceiver,
//   $.drop(linespace),
//   $.optional([ $.drop(":"), $.drop(linespace), typedecl, $.drop(linespace) ], ""),
//   $.drop("->"),
//   $.drop(linespace),
//   () => expression
// ]).map(match => {
//   if (match[2] == "") match[2] = [ null ];
//   return new POn(match[1], match[3], match[2][0], match[0]);
// });
//
// export const code = $.alt(
//   localLet,
//   localMake,
//   assignment,
//   returnEarly,
//   breakEarly,
//   handler,
//   () => expression
// ).named("expression");
//
// export const codeBlock = repeatSurrounded(
//   $.commit("{"),
//   code,
//   lf,
//   "}",
//   commentspace,
//   "declaration or expression"
// ).map((match, span) => {
//   return new PBlock(match[0], match[1], span);
// });

export const code: Parser<Token, PNode> = alt(
  localLet,
  assignment,
  returnEarly,
  breakEarly,
  () => expression
).named("expression", 2);

export const codeBlock = repeatSurrounded(
  TokenType.OBRACE,
  code,
  TokenType.SEMICOLON,
  TokenType.CBRACE,
  "declaration or expression"
).map(code => new PBlock(code));
