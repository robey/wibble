import { alt, optional, Parser, seq3, seq4, Token } from "packrattle";
import { PArray, PFunction, PNode, PReference } from "../common/ast";
import { code } from "./p_code";
import { constant } from "./p_const";
import { failWithPriority, linespace, repeatSurrounded } from "./p_parser";
import { IDENTIFIER_LIKE, tokenizer, TokenType } from "./p_tokens";
import { compoundType, typedecl } from "./p_type";

// import {
//   PArray, PBinary, PCall, PFunction, PIf, PNew, PReference, PRepeat, PStruct,
//   PStructField, PUnary, PWhile
// } from "../common/ast";
// import { code, codeBlock } from "./p_code";
// import { SYMBOL_NAME, commentspace, isReserved, linespace, repeatSurrounded, toSpan } from "./p_common";

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

// export const func = $([
//   $.optional([
//     compoundType,
//     $.drop(linespace),
//     $.optional([ $.drop(":"), $.drop(linespace), typedecl, $.drop(linespace) ])
//   ], []),
//   toSpan("->"),
//   $.drop(linespace),
//   () => code
// ]).named("function").map(match => {
//   return new PFunction(match[0][0], match[0][1] ? match[0][1][0] : null, match[2], match[1]);
// });
//
// const structMember = $([
//   $.optional([ SYMBOL_NAME, linespace, "=", linespace ], []),
//   () => code
// ]).map(([ prefix, value ], span) => {
//   return new PStructField(prefix.length > 0 ? prefix[0][0] : null, value, span);
// });
//
// const struct = repeatSurrounded(
//   $.commit("("),
//   structMember,
//   /[\n,]+/,
//   $.commit(")"),
//   commentspace,
//   "struct member"
// ).map(([ items, comment ], span) => {
//   // AST optimization: "(expr)" is just a precedence-bumped expression.
//   if (items.length == 1 && items[0].name == null) return items[0].children[0];
//   return new PStruct(items, comment, span);
// }).named("struct");
//
// const newObject = $([
//   toSpan("new"),
//   $.optional([ $.drop(linespace), typedecl ], []),
//   $.drop(linespace),
//   () => codeBlock
// ]).map(([ span, type, code ]) => new PNew(code, type[0], span));

const atom = alt(
  constant,
  reference,
  array,
  // struct,
  // () => codeBlock,
  // newObject
).named("atom");

// const unary = $.alt(
//   [ $.commit(/(-(?!>)|not)/), $.drop(linespace), () => unary ],
//   [ atom ]
// ).named("unary").map(([ op, expr ], span) => {
//   if (!expr) return op;
//   return new PUnary(op[0], expr, span);
// });
//
// const call = $([
//   unary,
//   $.repeatIgnore(atom, linespace)
// ]).map(([ first, rest ]) => {
//   return [ first ].concat(rest).reduce((x, y) => new PCall(x, y, x.span.merge(y.span)));
// });
//
// // helper
// function binary(subexpr, op) {
//   const sep = $.commit([ $.drop(linespace), op, commentspace ]);
//   return $.reduce($(subexpr).named("operand"), sep, {
//     first: x => x,
//     next: (left, [ op, comment ], right) => {
//       const binary = new PBinary(left, op, right, left.span.merge(right.span));
//       if (comment) binary.comment = comment;
//       return binary;
//     }
//   }).named("binary(" + op + ")");
// }
//
// const power = binary(call, "**");
// const factor = binary(power, $.alt("*", "/", "%"));
// const term = binary(factor, $.alt("+", "-"));
// const comparison = binary(term, $.alt("==", ">=", "<=", "!=", "<", ">"));
// const logicalAnd = binary(comparison, "and");
// const logical = binary(logicalAnd, "or");
//
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
const baseExpression: Parser<Token, PNode> = alt(func, atom);

export const expression = baseExpression;
