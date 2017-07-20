import { alt, optional, Parser, repeat, seq2, seq3, seq4, seq5, seq7, seq8, Token } from "packrattle";
import {
  PArray,
  PBinary,
  PCall,
  PFunction,
  PIf,
  PNested,
  PNew,
  PNode,
  PReference,
  PRepeat,
  PStruct,
  PStructField,
  PUnary,
  PWhile
} from "../common/ast";
import { code, codeBlock } from "./p_code";
import { constant } from "./p_const";
import { failWithPriority, linespace, linespaceAround, repeatSurrounded, whitespace } from "./p_parser";
import { IDENTIFIER_LIKE, OPERATORS, tokenizer, TokenType } from "./p_tokens";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions
 */

const ReservedError = "Reserved word can't be used as identifier";
const LowercaseError = "Variable name must start with lowercase letter";

export const reference = tokenizer.matchOneOf(...IDENTIFIER_LIKE).named("identifier").map(token => {
  if (token.tokenType.id != TokenType.IDENTIFIER) throw failWithPriority(ReservedError);
  if (!token.value.match(/^[a-z]/)) throw failWithPriority(LowercaseError);
  return new PReference(token);
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
  if (args === undefined) return new PFunction(undefined, [], undefined, gap2, body);

  const [ argType, space1, results ] = args;
  const gap1 = [];
  if (space1 !== undefined) gap1.push(space1);
  if (results === undefined) return new PFunction(argType, gap1, undefined, gap2, body);

  const [ colon, space2, resultType, space3 ] = results;
  gap1.push(colon);
  if (space2 !== undefined) gap1.push(space2);
  if (space3 !== undefined) gap2.unshift(space3);
  return new PFunction(argType, gap1, resultType, gap2, body);
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
  const p: Parser<Token, PNode> = alt(
    subexpr,
    seq3(() => p, sep, subexpr.named("operand")).map(([ left, [ gap1, op, gap2 ], right]) => {
      return new PBinary(left, gap1, op, gap2, right);
    })
  );
  return p;
}

const power = binary(call, TokenType.POWER).named("power");
const factor = binary(power, TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO).named("factor");
const term = binary(factor, TokenType.PLUS, TokenType.MINUS).named("term");
const comparison = binary(
  term,
  TokenType.EQUALS,
  TokenType.NOT_EQUALS,
  TokenType.GREATER_THAN,
  TokenType.LESS_THAN,
  TokenType.GREATER_EQUALS,
  TokenType.LESS_EQUALS
).named("comparison");
const logicalAnd = binary(comparison, TokenType.AND).named("logicalAnd");
const logical = binary(logicalAnd, TokenType.OR).named("logical");

const binaries = alt(
  logical,
  // fake alt to provide a good error message for missing right-side operands in binaries
  seq4(
    logical,
    linespace,
    tokenizer.matchOneOf(TokenType.AND, TokenType.OR, ...OPERATORS),
    atom.named("operand")
  ).map(([ x, _a, _b, _c ]) => x)
);

const condition = seq8(
  tokenizer.match(TokenType.IF),
  linespace,
  () => code,
  linespace,
  tokenizer.match(TokenType.THEN),
  linespace,
  () => code,
  optional(seq4(
    linespace,
    tokenizer.match(TokenType.ELSE),
    linespace,
    () => code
  ))
).named("condition").map(([ token1, space1, condition, space2, token2, space3, onTrue, elseBlock ]) => {
  const gap1 = [ token1 ];
  if (space1 !== undefined) gap1.push(space1);
  const gap2 = (space2 == undefined ? [] : [ space2 ]).concat(token2);
  if (space3 !== undefined) gap2.push(space3);
  const gap3 = [];
  let onFalse: PNode | undefined = undefined;
  if (elseBlock !== undefined) {
    const [ space4, token3, space5, node ] = elseBlock;
    if (space4 !== undefined) gap3.push(space4);
    gap3.push(token3);
    if (space5 !== undefined) gap3.push(space5);
    onFalse = node;
  }
  return new PIf(gap1, condition, gap2, onTrue, gap3, onFalse);
});

const repeatLoop = seq3(
  tokenizer.match(TokenType.REPEAT),
  linespace,
  () => code
).map(([ token, gap, expr ]) => {
  return new PRepeat(token, gap, expr);
})

const whileLoop = seq7(
  tokenizer.match(TokenType.WHILE),
  linespace,
  () => code,
  linespace,
  tokenizer.match(TokenType.DO),
  linespace,
  () => code
).map(([ token1, gap1, condition, gap2, token2, gap3, expr ]) => {
  return new PWhile(token1, gap1, condition, gap2, token2, gap3, expr);
});

const baseExpression: Parser<Token, PNode> = alt(condition, repeatLoop, whileLoop, func, logical);

export const expression = baseExpression;
