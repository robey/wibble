import { alt, mergeSpan, Parser, seq, Token } from "packrattle";
import { PConstant, PConstantType } from "../common/ast";
import { uncstring } from "../common/strings";
import { failWithPriority } from "./p_parser";
import { OPERATORS, tokenizer, TokenType } from "./p_tokens";

/*
 * parse constants
 */

const nothing = tokenizer.match(TokenType.NOTHING).map(token => new PConstant(PConstantType.NOTHING, "", token.span));

const boolean = alt(tokenizer.match(TokenType.TRUE), tokenizer.match(TokenType.FALSE)).map(token => {
  return new PConstant(PConstantType.BOOLEAN, token.value, token.span);
});

export const symbolRef = seq(
  tokenizer.match(TokenType.SYMBOL),
  alt(
    tokenizer.match(TokenType.IDENTIFIER),
    ...OPERATORS.map(op => tokenizer.match(op)),
  ).mapError("Invalid symbol name after .")
).map(match => new PConstant(PConstantType.SYMBOL, match[1].value, mergeSpan(match[0].span, match[1].span)));

const numberBase2 = tokenizer.match(TokenType.NUMBER_BASE2).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE2, token.value.slice(2), token.span);
});

const numberBase10 = tokenizer.match(TokenType.NUMBER_BASE10).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE10, token.value, token.span);
});

const numberBase16 = tokenizer.match(TokenType.NUMBER_BASE16).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE16, token.value.slice(2), token.span);
});

const string = tokenizer.match(TokenType.STRING).map(token => {
  try {
    return new PConstant(PConstantType.STRING, uncstring(token.value.slice(1, -1)), token.span);
  } catch (error) {
    throw failWithPriority(error.message);
  }
});

export const constant = alt(
  nothing,
  boolean,
  symbolRef,
  numberBase2,
  numberBase10,
  numberBase16,
  string
).named("constant");
