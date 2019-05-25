import { alt, optional, Parser, repeat, seq2, seq3, seq4, seq5, seq7, seq8, Token } from "packrattle";
import {
  PArray,
  PBinary,
  PCall,
  PExpr,
  PFunction,
  PIf,
  PNested,
  PNew,
  PReference,
  PRepeat,
  PStruct,
  PStructField,
  PUnary,
  PWhile,
} from "../common/ast";
import { IDENTIFIER_LIKE, OPERATORS, TokenType } from "../common/tokens";
import { code, codeBlock } from "./p_code";
import { constant } from "./p_const";
import { failWithPriority, linespace, linespaceAround, repeatSurrounded, tokenizer, whitespace } from "./p_parser";
import { compoundType, typedecl } from "./p_type";

/*
 * parse expressions
 */

const ReservedError = "Reserved word can't be used as identifier";
const LowercaseError = "Variable name must start with lowercase letter";

export const reference = tokenizer.matchOneOf(...IDENTIFIER_LIKE).named("identifier").map(t => {
  if (t.tokenType.id != TokenType.IDENTIFIER && t.tokenType.id != TokenType.QUOTED_IDENTIFIER) {
    throw failWithPriority(ReservedError);
  }
  if (!t.value.match(/^`?[a-z]/)) throw failWithPriority(LowercaseError);
  return new PReference(t);
});

const array: Parser<Token, PExpr> = repeatSurrounded(
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
  if (args === undefined) return new PFunction(
    undefined, undefined, undefined, undefined, undefined, undefined, arrow, space4, body
  );

  const [ argType, space1, results ] = args;
  if (results === undefined) return new PFunction(
    argType, space1, undefined, undefined, undefined, undefined, arrow, space4, body
  );

  const [ colon, space2, resultType, space3 ] = results;
  return new PFunction(
    argType, space1, colon, space2, resultType, space3,
    arrow, space4, body
  );
});

const structMember = seq2(
  optional(seq2(reference, linespaceAround(tokenizer.match(TokenType.BIND)))),
  () => code
).map(([ prefix, value ]) => {
  if (prefix !== undefined) {
    const [ ref, gap ] = prefix;
    return new PStructField(ref.token, gap, value);
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
).map(collection => {
  // AST optimization: "(expr)" is just a precedence-bumped expression.
  if (collection.list.length == 1 && collection.list[0].item.name == undefined) {
    return new PNested(
      collection.open,
      collection.gap1,
      collection.list[0].item.value,
      collection.gap2,
      collection.close
    );
  }
  return new PStruct(collection);
});

const newObject = seq5(
  tokenizer.match(TokenType.NEW),
  linespace,
  optional(typedecl),
  linespace,
  () => codeBlock
).map(([ t, gap1, type, gap2, code ]) => {
  return new PNew(t, gap1, type, gap2, code);
});

const atom = alt(
  constant,
  reference,
  array,
  struct,
  () => codeBlock,
  newObject
).named("atom");

const unary: Parser<Token, PExpr> = seq3(
  tokenizer.matchOneOf(TokenType.NOT, TokenType.MINUS),
  linespace,
  alt(() => unary, atom)
).map(([ t, gap, inner ]) => {
  return new PUnary(t, gap, inner);
});

const call = seq2(alt(unary, atom), repeat(seq2(linespace, atom))).map(([ first, rest ]) => {
  return rest.reduce((left, [ gap, right ]) => {
    return new PCall(left, gap, right);
  }, first);
});

// helper
function binary(subexpr: Parser<Token, PExpr>, ...ops: TokenType[]): Parser<Token, PExpr> {
  const sep = seq3(linespace, tokenizer.matchOneOf(...ops), whitespace);
  const p: Parser<Token, PExpr> = alt(
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
  if (elseBlock === undefined) return new PIf(
    token1, space1, condition, space2, token2, space3, onTrue
  );
  const [ space4, token3, space5, node ] = elseBlock;
  return new PIf(
    token1, space1, condition, space2, token2, space3, onTrue,
    space4, token3, space5, node
  );
});

const repeatLoop = seq3(
  tokenizer.match(TokenType.REPEAT),
  linespace,
  () => code
).map(([ t, gap, expr ]) => {
  return new PRepeat(t, gap, expr);
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

const baseExpression: Parser<Token, PExpr> = alt(condition, repeatLoop, whileLoop, func, logical);

export const expression = baseExpression;
