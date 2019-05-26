import { Span, Token } from "packrattle";
import { Errors, TokenType, transformAst } from "../common";
import * as ast from "../ast";
import { injectToken, tokenizer } from "../parser/p_parser";
import { PIf } from "../ast/ast_expr";

/*
 * perform some basic simplifications and error checks on the parse tree,
 * before type-checking.
 */
export function simplify(tree: ast.PNode, errors: Errors) {
  /*
   * assign new variable names starting with '_' (which is not allowed by
   * user-written code).
   */
  let generateIndex = 0;
  function nextLocal(): string {
    return `_${generateIndex++}`;
  }

  return transformAst(tree, node => {
    switch (node.nodeType) {

      case ast.PExprKind.FUNCTION: {
        return functionToObject(node as ast.PFunction);
      }

//       case PExprKind.STRUCT: {
//         const tnode = node as PStruct;
//         // convert positional fields into named fields. (adds a name in-place)
//         let positional = true, changed = false;
//         const seen: { [name: string]: boolean } = {};

//         const newItems = transformCollection(tnode.items, (item, i) => {
//           if (item.name === undefined) {
//             if (!positional) errors.add("Positional fields can't come after named fields", item);
//             changed = true;
//             return new PStructField(
//               identifier(`?${i}`, item.span.start),
//               [ makeToken[TokenType.BIND](item.span.start) ],
//               item.childExpr[0]
//             );
//           }
//           positional = false;
//           if (seen[item.name.value]) errors.add(`Field name '${item.name.value}' is repeated`, item);
//           seen[item.name.value] = true;
//           return item;
//         });
//         return changed ? new PStruct(newItems) : null;
//       }

      case ast.PExprKind.NEW: {
        checkNew(node as ast.PNew, errors);
        return undefined;
      }

      case ast.PExprKind.UNARY: {
        return unaryToCall(node as ast.PUnary);
      }

      case ast.PExprKind.BINARY: {
        return binaryToCall(node as ast.PBinary);
      }

      case ast.PExprKind.IF: {
        return checkIf(node as ast.PIf);
      }

      case ast.PExprKind.WHILE: {
        return whileToRepeat(node as ast.PWhile, nextLocal());
      }

      case ast.PExprKind.ASSIGNMENT: {
        checkAssignment(node as ast.PAssignment, errors);
        return undefined;
      }

      case ast.PExprKind.RETURN: {
        checkReturn(node as ast.PReturn, errors);
        return undefined;
      }

      case ast.PExprKind.BREAK: {
        checkBreak(node as ast.PBreak, errors);
        return undefined;
      }

      case ast.PExprKind.BLOCK: {
        return simplifyBlock(node as ast.PBlock);
      }


// //       case "POn": {
// //         // must be inside a "new" block.
// //         if (parentType(0) == "PNew" || (parentType(0) == "PBlock" && parentType(1) == "PNew")) {
// //           return null;
// //         } else {
// //           errors.add("'on' handlers must be inside a 'new' expression", node.span);
// //           return null;
// //         }
// //       }
// //

// //
// //       // we allow statements everywhere in the parser, to make errors nicer. but here we check and redcard.
// //       case "PLocals": {
// //         if (parentType() != "PBlock") errors.add("Locals may only be defined inside a code block", node.span);
// //         return null;
// //       }
// //
// //
// //

      default:
        return undefined;
    }
  });
}

// convert function(inType?, outType?, a) into new(on(inType, a, outType))
function functionToObject(node: ast.PFunction): ast.PNew {
  return makeNew(
    makeBlock(makeHandler(
      node.inType || new ast.PEmptyType(injectToken(TokenType.NOTHING, node.span.start)),
      node.outType,
      node.body()
    ))
  );
}

function checkNew(node: ast.PNew, errors: Errors) {
  // "new" must contain either an "on", or a block that contains at least one "on".
  const code = node.code();
  if (code.nodeType != ast.PExprKind.BLOCK && code.nodeType != ast.PExprKind.ON) {
    errors.add("'new' expression must contain at least one 'on' handler", node);
  }
  if (code.nodeType == ast.PExprKind.BLOCK) {
    const handlers = code.expressions().filter(n => n.nodeType == ast.PExprKind.ON);
    if (handlers.length == 0) {
      errors.add("'new' expression must contain at least one 'on' handler", node);
    }
  }
}

// convert unary(op)(a) into call(a, op)
function unaryToCall(node: ast.PUnary): ast.PCall {
  return makeCall(
    node.expr(),
    makeSymbol(node.op.value == "-" ? "negative" : node.op.value, node.children[0].span.end)
  );
}

// convert binary(logic-op)(a, b) into logic(logic-op)(a, b) or call(call(a, op), b)
function binaryToCall(node: ast.PBinary): ast.PLogic | ast.PCall {
  if (node.op.tokenType.id == TokenType.OR || node.op.tokenType.id == TokenType.AND) {
    return new ast.PLogic(node.left(), node.gap1, node.op, node.gap2, node.right());
  }
  return makeCall(
    makeCall(wrap(node.left()), makeSymbol(node.op.value, node.left().span.end)),
    wrap(node.right())
  );
}

// ensure every "if" has an "else".
function checkIf(node: ast.PIf): ast.PIf | undefined {
  const [ condition, onTrue, onFalse ] = node.expressions();
  if (onFalse !== undefined) return undefined;

  const index = onTrue.span.end;
  return new PIf(
    node.ifToken, node.space1, condition, node.space2, node.thenToken, node.space3,
    onTrue, sp(index), injectToken(TokenType.ELSE, index), sp(index), nothing(index)
  );
}

// convert while(a, b) into if(a, repeat(block(local(?0, b), if(not(a), break(?0))))).
function whileToRepeat(node: ast.PWhile, newVar: string): ast.PIf {
  const [ condition, expr ] = node.expressions();
  const newLocal = makeLocal(identifier(newVar, expr.span.start), expr);
  const breakOut = makeIf(
    makeCall(condition, makeSymbol("not", condition.span.end)),
    makeBreak(new ast.PReference(identifier(newVar, condition.span.end))),
    nothing(condition.span.end)
  );
  return makeIf(condition, makeRepeat(makeBlock(newLocal, breakOut)), nothing(node.span.end));
}

function checkAssignment(node: ast.PAssignment, errors: Errors) {
  if (node.parentExpr && node.parentExpr.nodeType != ast.PExprKind.BLOCK) {
    errors.add("Mutable assignments may only occur inside a code block", node);
  }
}

// "return" must be inside an "on" handler.
function checkReturn(node: ast.PReturn, errors: Errors) {
  if (!node.containedInside(ast.PExprKind.ON)) {
    errors.add("'return' must be inside a function or handler", node);
  }
}

// "break" must be inside a loop.
function checkBreak(node: ast.PBreak, errors: Errors) {
  if (!node.containedInside(ast.PExprKind.REPEAT)) {
    errors.add("'break' must be inside a loop", node);
  }
}

// convert one-expression block into that expression.
function simplifyBlock(node: ast.PBlock): ast.PNested | undefined {
  const expr = node.expressions();
  if (
    expr.length == 1 &&
    [ ast.PExprKind.LOCALS, ast.PExprKind.ASSIGNMENT, ast.PExprKind.ON ].indexOf(expr[0].nodeType) < 0
  ) return wrap(expr[0]);
  return undefined;
}






// xxx probably not used
// function makeNewWithType(type: ast.PType | undefined, code: ast.PExpr): ast.PNew {
//   const index = type === undefined ? code.span.start : type.span.start;
//   return new ast.PNew(
//     injectToken(TokenType.NEW, index), sp(index), type, type === undefined ? undefined : sp(code.span.start), code
//   );
// }








// function transformCollection<A extends PExpr>(
//   items: TokenCollection<A>,
//   f: (item: A, index: number) => A
// ): TokenCollection<A> {
//   const newList = items.list.map((item, i) => replaceAnnotatedItem(item, f(item.item, i)));
//   return new TokenCollection(items.open, items.gap1, newList, items.gap2, items.close);
// }

// function replaceAnnotatedItem<A extends PExpr>(item: AnnotatedItem<A>, value: A): AnnotatedItem<A> {
//   return new AnnotatedItem(value, item.gap1, item.separator, item.gap2);
// }


// ----- helpers to generate tokens

function makeSymbol(name: string, index: number): ast.PConstant {
  return new ast.PConstant(ast.PConstantType.SYMBOL, [ identifier(`.${name}`, index) ], name);
}

// put inside a PNested, to preserve precedence when dumping
function wrap(node: ast.PExpr): ast.PNested {
  return new ast.PNested(
    injectToken(TokenType.OPAREN, node.span.start), [], node, [], injectToken(TokenType.CPAREN, node.span.end)
  );
}

function makeNew(code: ast.PExpr): ast.PNew {
  const index = code.span.start;
  return new ast.PNew(injectToken(TokenType.NEW, index), sp(index), undefined, undefined, code);
}

function makeCall(a: ast.PExpr, b: ast.PExpr): ast.PCall {
  return new ast.PCall(a, sp(a.span.end), b);
}

function makeIf(condition: ast.PExpr, ifTrue: ast.PExpr, ifFalse: ast.PExpr): PIf {
  const fakeIf = injectToken(TokenType.IF, condition.span.start);
  const sp1 = sp(condition.span.start);
  const fakeThen = injectToken(TokenType.THEN, ifTrue.span.start);
  const sp2 = sp(ifTrue.span.start);
  const fakeElse = injectToken(TokenType.ELSE, ifFalse.span.start);
  const sp3 = sp(ifFalse.span.start);
  return new PIf(fakeIf, sp1, condition, sp2, fakeThen, sp2, ifTrue, sp3, fakeElse, sp3, ifFalse);
}

function makeRepeat(expr: ast.PExpr): ast.PRepeat {
  return new ast.PRepeat(injectToken(TokenType.REPEAT, expr.span.start), sp(expr.span.start), expr);
}

function makeBreak(expr: ast.PExpr): ast.PBreak {
  return new ast.PBreak(injectToken(TokenType.BREAK, expr.span.start), sp(expr.span.start), expr);
}

function makeLocal(name: Token, value: ast.PExpr): ast.PLocals {
  const index = value.span.start;
  const newLocal = new ast.PLocal(
    undefined, undefined, name, sp(index), injectToken(TokenType.BIND, index), sp(index), value
  );
  return new ast.PLocals(
    injectToken(TokenType.LET, index), sp(index), [ new ast.AnnotatedItem(newLocal, undefined, undefined, []) ]
  );
}

function makeHandler(receiver: ast.PConstant | ast.PType, type: ast.PType | undefined, expr: ast.PExpr): ast.POn {
  return new ast.POn(
    injectToken(TokenType.ON, receiver.span.start),
    sp(receiver.span.start),
    receiver,
    type === undefined ? undefined : injectToken(TokenType.COLON, type.span.start),
    type === undefined ? undefined : sp(type.span.start),
    type,
    sp(expr.span.start),
    injectToken(TokenType.ARROW, expr.span.start),
    sp(expr.span.start),
    expr
  );
}

// put expressions in a block
function makeBlock(...nodes: ast.PExpr[]): ast.PBlock {
  const list = nodes.map((expr, i) => {
    const last = i == nodes.length - 1;
    const index = expr.span.end;
    const semi = last ? undefined : injectToken(TokenType.SEMICOLON, index);
    return new ast.AnnotatedItem(expr, undefined, semi, last ? [] : [ sp(index) ]);
  });
  const left = list[0].span.start;
  const right = list[list.length - 1].span.end;
  const collection = new ast.TokenCollection<ast.PExpr>(
    injectToken(TokenType.OBRACE, left),
    [ sp(left) ],
    list,
    [ sp(right) ],
    injectToken(TokenType.CBRACE, right)
  );
  return new ast.PBlock(collection);
}

function sp(index: number): Token {
  return tokenizer.token(TokenType.LINESPACE, new Span(index, index), " ");
}

function identifier(name: string, index: number): Token {
  return tokenizer.token(TokenType.IDENTIFIER, new Span(index, index), name);
}

function nothing(index: number): ast.PConstant {
  return new ast.PConstant(ast.PConstantType.NOTHING, [ injectToken(TokenType.NOTHING, index) ]);
}
