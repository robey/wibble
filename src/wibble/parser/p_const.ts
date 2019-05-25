import { alt, seq2 } from "packrattle";
import * as ast from "../common/ast";
import { uncstring } from "../common/strings";
import { OPERATORS, TokenType } from "../common/tokens";
import { failWithPriority, tokenizer } from "./p_parser";

/*
 * parse constants
 */

const nothing = tokenizer.match(TokenType.NOTHING).map(t => {
  return new ast.PConstant(ast.PConstantType.NOTHING, [ t ]);
});

const boolean = tokenizer.matchOneOf(TokenType.TRUE, TokenType.FALSE).map(t => {
  return new ast.PConstant(ast.PConstantType.BOOLEAN, [ t ]);
});

export const symbolRef = seq2(
  tokenizer.match(TokenType.SYMBOL),
  tokenizer.matchOneOf(...OPERATORS.concat(TokenType.IDENTIFIER)).mapError("Invalid symbol name after .")
).map(t => new ast.PConstant(ast.PConstantType.SYMBOL, t, t[1].value));

const numberBase2 = tokenizer.match(TokenType.NUMBER_BASE2).map(t => {
  return new ast.PConstant(ast.PConstantType.NUMBER_BASE2, [ t ], t.value.slice(2));
});

const numberBase10 = tokenizer.match(TokenType.NUMBER_BASE10).map(t => {
  return new ast.PConstant(ast.PConstantType.NUMBER_BASE10, [ t ]);
});

const numberBase16 = tokenizer.match(TokenType.NUMBER_BASE16).map(t => {
  return new ast.PConstant(ast.PConstantType.NUMBER_BASE16, [ t ], t.value.slice(2));
});

const string = tokenizer.match(TokenType.STRING).map(t => {
  try {
    return new ast.PConstant(ast.PConstantType.STRING, [ t ], uncstring(t.value.slice(1, -1)));
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
