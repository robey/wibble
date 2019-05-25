import { LazyParser, optional, Parser, repeat, seq2, seq3, seq4, seq5, Span, Token, Tokenizer } from "packrattle";
import * as ast from "../common/ast";
import { tokenRules, TokenType, WHITESPACE } from "../common/tokens";

export const tokenizer = new Tokenizer(TokenType, tokenRules);

// make a token generator for each string type
export const makeToken: { [id: number]: (index: number) => Token } = {};
(tokenizer.rules.strings || []).forEach(([ value, type ]) => {
  makeToken[type] = (index: number) => tokenizer.token(type, new Span(index, index), value);
});

interface Prioritized {
  priority?: number;
}

export function failWithPriority(message: string): Error {
  const error = new Error(message);
  (error as Prioritized).priority = 1;
  return error;
}

export const linespace = optional(tokenizer.match(TokenType.LINESPACE));
export const whitespace = repeat(tokenizer.matchOneOf(...WHITESPACE));

export function linespaceAround(p: LazyParser<Token, Token>): Parser<Token, Token[]> {
  return seq3(linespace, p, linespace).map(([ gap1, token, gap2 ]) => {
    const rv: Token[] = [];
    if (gap1 !== undefined) rv.push(gap1);
    rv.push(token);
    if (gap2 !== undefined) rv.push(gap2);
    return rv;
  });
}

// match: (p linespace separator ws)* p?
export function repeatSeparated<A extends ast.PNode>(
  p: LazyParser<Token, A>,
  ...separators: TokenType[]
): Parser<Token, ast.AnnotatedItem<A>[]> {
  const element = seq4(p, linespace, tokenizer.matchOneOf(...separators), whitespace).map(([ a, ls, sep, ws ]) => {
    return new ast.AnnotatedItem(a, ls, sep, ws);
  });

  return seq2(repeat(element), optional(p)).map(([ list, last ]) => {
    return list.concat(last ? [ new ast.AnnotatedItem(last, undefined, undefined, []) ] : []);
  });
}

// open (ws repeatSeparated)? ws close
export function repeatSurrounded<A extends ast.PNode>(
  open: TokenType,
  p: LazyParser<Token, A>,
  separator: TokenType,
  close: TokenType,
  name?: string
): Parser<Token, ast.TokenCollection<A>> {
  return seq5(
    tokenizer.match(open),
    whitespace,
    repeatSeparated(p, separator, TokenType.LF),
    whitespace,
    name ? tokenizer.match(close).named(name, 1) : tokenizer.match(close)
  ).map(([ o, ws1, inner, ws2, c ]) => {
    return new ast.TokenCollection(o, ws1, inner, ws2, c);
  });
}
