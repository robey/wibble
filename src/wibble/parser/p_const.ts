import { alt, mergeSpan, Parser, seq2, Token } from "packrattle";
import { PConstant, PConstantType } from "../common/ast";
import { uncstring } from "../common/strings";
import { failWithPriority } from "./p_parser";
import { OPERATORS, tokenizer, TokenType } from "./p_tokens";

/*
 * parse constants
 */

const nothing = tokenizer.match(TokenType.NOTHING).map(token => {
  return new PConstant(PConstantType.NOTHING, [ token ]);
});

const boolean = alt(tokenizer.match(TokenType.TRUE), tokenizer.match(TokenType.FALSE)).map(token => {
  return new PConstant(PConstantType.BOOLEAN, [ token ]);
});

export const symbolRef = seq2(
  tokenizer.match(TokenType.SYMBOL),
  tokenizer.matchOneOf(...OPERATORS.concat(TokenType.IDENTIFIER)).mapError("Invalid symbol name after .")
).map(tokens => new PConstant(PConstantType.SYMBOL, tokens, tokens[1].value));

const numberBase2 = tokenizer.match(TokenType.NUMBER_BASE2).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE2, [ token ], token.value.slice(2));
});

const numberBase10 = tokenizer.match(TokenType.NUMBER_BASE10).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE10, [ token ]);
});

const numberBase16 = tokenizer.match(TokenType.NUMBER_BASE16).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE16, [ token ], token.value.slice(2));
});

const string = tokenizer.match(TokenType.STRING).map(token => {
  try {
    return new PConstant(PConstantType.STRING, [ token ], uncstring(token.value.slice(1, -1)));
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
