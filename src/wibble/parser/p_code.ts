import { alt, optional, Parser, seq2, seq3, seq5, seq6, seq8, Token } from "packrattle";
import {
  PAssignment, PBlock, PBreak, PConstant, PExpr, PLocal, PLocals, PNodeToken, POn, PReturn, PType
} from "../common/ast";
import { tokenizer, TokenType } from "../common/tokens";
import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";
import { linespace, repeatSeparated, repeatSurrounded } from "./p_parser";
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
).named("assignment").map(([ name, gap1, t, gap2, expr ]) => {
  return new PAssignment(name, gap1, t, gap2, expr);
});

const returnEarly = seq3(
  tokenizer.match(TokenType.RETURN),
  linespace,
  () => code
).named("return").map(([ t, gap, expr ]) => {
  return new PReturn(t, gap, expr);
});

const breakEarly = seq2(
  tokenizer.match(TokenType.BREAK),
  optional(seq2(linespace, () => code))
).map(([ t, optionalExpr ]) => {
  if (optionalExpr === undefined) return new PBreak(t);
  const [ gap, expr ] = optionalExpr;
  return new PBreak(t, gap, expr);
});

const localDeclaration = seq6(
  optional(seq2(tokenizer.match(TokenType.VAR), linespace)),
  reference,
  linespace,
  tokenizer.match(TokenType.BIND),
  linespace,
  () => expression
).map(([ optionalVar, name, gap2, op, gap3, expr ]) => {
  if (optionalVar === undefined) {
    return new PLocal(undefined, undefined, name.token, gap2, op, gap3, expr);
  }
  const [ isVar, gap1 ] = optionalVar;
  return new PLocal(isVar, gap1, name.token, gap2, op, gap3, expr);
});

const localLet = seq3(
  tokenizer.match(TokenType.LET),
  linespace,
  repeatSeparated(localDeclaration, TokenType.COMMA)
).map(([ t, gap, items ]) => {
  return new PLocals(t, gap, items);
});

const handler = seq8(
  tokenizer.match(TokenType.ON),
  linespace,
  alt<Token, PConstant | PType>(emptyType, symbolRef, compoundType).named("symbol or parameters"),
  optional(seq3(tokenizer.match(TokenType.COLON), linespace, typedecl)),
  linespace,
  tokenizer.match(TokenType.ARROW),
  linespace,
  () => expression
).map(([ onToken, gap1, receiver, optionalType, gap2, arrow, gap3, expr ]) => {
  if (optionalType === undefined) return new POn(
    onToken, gap1, receiver, undefined, undefined, undefined, gap2, arrow, gap3, expr
  );
  const [ colon, gap, t ] = optionalType;
  return new POn(onToken, gap1, receiver, colon, gap, t, gap2, arrow, gap3, expr);
});

export const code: Parser<Token, PExpr> = alt(
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
