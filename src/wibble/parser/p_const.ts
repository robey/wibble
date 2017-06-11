import { alt, matchToken, mergeSpan, Parser, seq, Token } from "packrattle";
import { PConstant, PConstantType } from "../common/ast";
import { uncstring } from "../common/strings";
import { OPERATORS, Tokens } from "./p_tokens";

/*
 * parse constants
 */

const nothing = matchToken(Tokens, Tokens.NOTHING).map(token => new PConstant(PConstantType.NOTHING, "", token.span));

const boolean = alt(matchToken(Tokens, Tokens.TRUE), matchToken(Tokens, Tokens.FALSE)).map(token => {
  return new PConstant(PConstantType.BOOLEAN, token.value, token.span);
});

export const symbolRef = seq(
  matchToken(Tokens, Tokens.SYMBOL),
  alt(
    matchToken(Tokens, Tokens.IDENTIFIER),
    ...OPERATORS.map(op => matchToken(Tokens, op)),
  ).mapError("Invalid symbol name after .")
).map(match => new PConstant(PConstantType.SYMBOL, match[1].value, mergeSpan(match[0].span, match[1].span)));

const numberBase2 = matchToken(Tokens, Tokens.NUMBER_BASE2).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE2, token.value.slice(2), token.span);
});

const numberBase10 = matchToken(Tokens, Tokens.NUMBER_BASE10).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE10, token.value, token.span);
});

const numberBase16 = matchToken(Tokens, Tokens.NUMBER_BASE16).map(token => {
  return new PConstant(PConstantType.NUMBER_BASE16, token.value.slice(2), token.span);
});

const string = matchToken(Tokens, Tokens.STRING).map(token => {
  return new PConstant(PConstantType.STRING, uncstring(token.value.slice(1, -1)), token.span);
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
