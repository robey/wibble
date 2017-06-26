import {
  alt, LazyParser, matchRegex, matchString, optional, Parser, repeat, seq2, seq3, seq4, Token
} from "packrattle";
import { TokenType, tokenizer, WHITESPACE } from "./p_tokens";
import { AnnotatedItem, PNode, TokenCollection } from "../common/ast";

interface Prioritized {
  priority?: number;
}

export function failWithPriority(message: string): Error {
  const error = new Error(message);
  (error as Prioritized).priority = 1;
  return error;
}

export const linespace = optional(tokenizer.match(TokenType.LINESPACE));
export const whitespace = repeat(alt(...WHITESPACE.map(t => tokenizer.match(t))));

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
export function repeatSeparated<A extends PNode>(
  p: LazyParser<Token, A>,
  separator: TokenType
): Parser<Token, AnnotatedItem<A>[]> {
  const sep = alt(tokenizer.match(separator), tokenizer.match(TokenType.LF))
  const element = seq4(p, linespace, tokenizer.match(separator), whitespace).map(([ a, ls, sep, ws ]) => {
    return new AnnotatedItem(a, ls, sep, ws);
  });

  return seq2(repeat(element), optional(p)).map(([ list, last ]) => {
    if (last) list.push(new AnnotatedItem(last, undefined, undefined, []));
    return list;
  });
}

// open (ws repeatSeparated)? ws close
export function repeatSurrounded<A extends PNode>(
  open: number,
  p: LazyParser<Token, A>,
  separator: number,
  close: number,
  name: string
): Parser<Token, TokenCollection<A>> {
  return seq4(
    tokenizer.match(open),
    optional(seq2(whitespace, repeatSeparated(p, separator))),
    whitespace,
    tokenizer.match(close).named(name)
  ).map(([ o, inner, ws, c ]) => {
    return new TokenCollection(o, inner ? inner[0] : [], inner ? inner[1] : [], ws, c);
  });
}
