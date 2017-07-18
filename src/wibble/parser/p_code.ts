import { alt, optional, Parser, seq2, seq3, seq5, seq6, seq8, Token } from "packrattle";
import { PAssignment, PBlock, PBreak, PLocal, PLocals, PNode, POn, PReturn } from "../common/ast";
import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";
import { linespace, repeatSeparated, repeatSurrounded } from "./p_parser";
import { tokenizer, TokenType } from "./p_tokens";
import { compoundType, emptyType, typedecl } from "./p_type";

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

const handler = seq8(
  tokenizer.match(TokenType.ON),
  linespace,
  alt<Token, PNode>(emptyType, symbolRef, compoundType).named("symbol or parameters"),
  optional(seq3(tokenizer.match(TokenType.COLON), linespace, typedecl)),
  linespace,
  tokenizer.match(TokenType.ARROW),
  linespace,
  () => expression
).map(([ onToken, gap1, receiver, optionalType, gap2, arrow, gap3, expr ]) => {
  const onTokens = [ onToken ];
  if (gap1 !== undefined) onTokens.push(gap1);
  const typeTokens = [];
  let type: PNode | undefined = undefined;
  if (optionalType !== undefined) {
    const [ colon, gap, t ] = optionalType;
    typeTokens.push(colon);
    if (gap !== undefined) typeTokens.push(gap);
    type = t;
  }
  const arrowTokens = [];
  if (gap2 !== undefined) arrowTokens.push(gap2);
  arrowTokens.push(arrow);
  if (gap3 !== undefined) arrowTokens.push(gap3);
  return new POn(onTokens, receiver, typeTokens, type, arrowTokens, expr);
})

export const code: Parser<Token, PNode> = alt(
  localLet,
  assignment,
  returnEarly,
  breakEarly,
  handler,
  () => expression
).named("expression", 2);

export const codeBlock = repeatSurrounded(
  TokenType.OBRACE,
  code,
  TokenType.SEMICOLON,
  TokenType.CBRACE,
  "declaration or expression"
).map(code => new PBlock(code));
