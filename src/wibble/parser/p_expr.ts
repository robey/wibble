import { alt, optional, Parser, reduce, repeat, seq2, seq3, seq4, seq5, Token } from "packrattle";
import {
  PArray, PBinary, PCall, PFunction, PNested, PNew, PNode, PReference, PStruct, PStructField, PUnary
} from "../common/ast";
import { code, codeBlock } from "./p_code";
import { constant } from "./p_const";
import { failWithPriority, linespace, linespaceAround, repeatSurrounded, whitespace } from "./p_parser";
import { IDENTIFIER_LIKE, tokenizer, TokenType } from "./p_tokens";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions
 */

const ReservedError = "Reserved word can't be used as identifier";
const LowercaseError = "Variable name must start with lowercase letter";

export const reference = tokenizer.matchOneOf(...IDENTIFIER_LIKE).named("identifier").map(token => {
  if (token.tokenType.id != TokenType.IDENTIFIER) throw failWithPriority(ReservedError);
  if (!token.value.match(/^[a-z]/)) throw failWithPriority(LowercaseError);
  return new PReference(token.value, token.span);
});

const array: Parser<Token, PNode> = repeatSurrounded(
  TokenType.OBRACKET,
  () => code,
  TokenType.COMMA,
  TokenType.CBRACKET,
  "array item"
).map(items => {
  return new PArray(items);
}).named("array");

export const func = seq4(
  optional(seq3(
    compoundType,
    linespace,
    optional(seq4(
      tokenizer.match(TokenType.COLON),
      linespace,
      typedecl,
      linespace
    ))
  )),
  tokenizer.match(TokenType.ARROW),
  linespace,
  () => code
).named("function").map(([ args, arrow, space4, body ]) => {
  const gap2 = [ arrow ];
  if (space4 !== undefined) gap2.push(space4);
  if (args === undefined) return new PFunction(undefined, [], undefined, gap2, body, arrow.span);

  const [ argType, space1, results ] = args;
  const gap1 = [];
  if (space1 !== undefined) gap1.push(space1);
  if (results === undefined) return new PFunction(argType, gap1, undefined, gap2, body, arrow.span);

  const [ colon, space2, resultType, space3 ] = results;
  gap1.push(colon);
  if (space2 !== undefined) gap1.push(space2);
  if (space3 !== undefined) gap2.unshift(space3);
  return new PFunction(argType, gap1, resultType, gap2, body, arrow.span);
});

const structMember = seq2(
  optional(seq2(reference, linespaceAround(tokenizer.match(TokenType.BIND)))),
  () => code
).map(([ prefix, value ]) => {
  if (prefix !== undefined) {
    const [ ref, gap ] = prefix;
    return new PStructField(ref, gap, value);
  } else {
    return new PStructField(undefined, [], value);
  }
});

const struct = repeatSurrounded(
  TokenType.OPAREN,
  structMember,
  TokenType.COMMA,
  TokenType.CPAREN,
  "struct member"
).map(items => {
  // AST optimization: "(expr)" is just a precedence-bumped expression.
  if (items.list.length == 1 && items.list[0].item.name === undefined) {
    return new PNested(items.open, items.gap1, items.list[0].item.value, items.gap2, items.close);
  }
  return new PStruct(items);
});

const newObject = seq5(
  tokenizer.match(TokenType.NEW),
  linespace,
  optional(typedecl),
  linespace,
  () => codeBlock
).map(([ token, gap1, type, gap2, code ]) => new PNew(token, gap1, type, gap2, code));

const atom = alt(
  constant,
  reference,
  array,
  struct,
  () => codeBlock,
  newObject
).named("atom");

const unary: Parser<Token, PNode> = seq3(
  tokenizer.matchOneOf(TokenType.NOT, TokenType.MINUS),
  linespace,
  alt(() => unary, atom)
).map(([ token, gap, inner ]) => new PUnary(token, gap, inner));

const call = seq2(alt(unary, atom), repeat(seq2(linespace, atom))).map(([ first, rest ]) => {
  return rest.reduce((left, [ gap, right ]) => new PCall(left, gap, right), first);
});

// helper
function binary(subexpr: Parser<Token, PNode>, ...ops: TokenType[]): Parser<Token, PNode> {
  const sep = seq3(linespace, tokenizer.matchOneOf(...ops), whitespace);
  return reduce<Token, PNode, [ Token | undefined, Token, Token[] ], PNode>(sep, subexpr, {
    first: x => x,
    next: (left, [ gap1, op, gap2 ], right) => {
      return new PBinary(left, gap1, op, gap2, right);
    }
  });
}

const power = binary(call, TokenType.POWER);
const factor = binary(power, TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO);
const term = binary(factor, TokenType.PLUS, TokenType.MINUS);
const comparison = binary(
  term,
  TokenType.EQUALS,
  TokenType.NOT_EQUALS,
  TokenType.GREATER_THAN,
  TokenType.LESS_THAN,
  TokenType.GREATER_EQUALS,
  TokenType.LESS_EQUALS
);
const logicalAnd = binary(comparison, TokenType.AND);
const logical = binary(logicalAnd, TokenType.OR);

// const condition = $([
//   toSpan("if"),
//   $.drop(linespace),
//   () => code,
//   $.drop(linespace),
//   toSpan("then"),
//   $.drop(linespace),
//   () => code,
//   $.optional([
//     $.drop(linespace),
//     toSpan("else"),
//     $.drop(linespace),
//     () => code
//   ], []).named("else clause")
// ]).named("condition").map(match => {
//   return new PIf(match[1], match[3], (match[4].length > 0) ? match[4][1] : null, match[0]);
// });
//
// const repeatLoop = $([
//   toSpan("repeat"),
//   $.drop(linespace),
//   () => code
// ]).named("repeat").map(match => new PRepeat(match[1], match[0]));
//
// const whileLoop = $([
//   toSpan("while"),
//   $.drop(linespace),
//   () => code,
//   $.drop(linespace),
//   $.commit("do").drop(),
//   $.drop(linespace),
//   () => code
// ]).named("while").map(match => new PWhile(match[1], match[2], match[0]));
//
// const baseExpression = $.alt(condition, repeatLoop, whileLoop, func, logical);
const baseExpression: Parser<Token, PNode> = alt(func, logical);

export const expression = baseExpression;
