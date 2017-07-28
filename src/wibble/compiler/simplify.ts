import { Span, Token } from "packrattle";
import {
  AnnotatedItem,
  PBinary,
  PBlock,
  PBreak,
  PCall,
  PConstant,
  PConstantType,
  PEmptyType,
  PExpr,
  PExprKind,
  PFunction,
  PIf,
  PLocal,
  PLocals,
  PLogic,
  PNested,
  PNew,
  PNode,
  POn,
  PReference,
  PRepeat,
  PStruct,
  PStructField,
  PType,
  PUnary,
  TokenCollection
} from "../common/ast";
import { Errors } from "../common/errors";
import { makeToken, tokenizer, TokenType } from "../parser/p_tokens";
import { transformAst } from "../common/transform";

/*
 * perform some basic simplifications and error checks on the parse tree,
 * before type-checking.
 */
export function simplify(ast: PNode, errors: Errors) {
  /*
   * assign new variable names starting with '_' (which is not allowed by
   * user-written code).
   */
  let generateIndex = 0;
  function nextLocal(): string {
    return `_${generateIndex++}`;
  }


  return transformAst(ast, node => {
    switch (node.nodeType) {

      case PExprKind.FUNCTION: {
        // convert function(inType?, outType?, a) into new(on(inType, a, outType))
        const tnode = node as PFunction;
        return makeNew(
          undefined,
          makeBlock(makeHandler(
            tnode.inType || new PEmptyType(makeToken[TokenType.NOTHING](tnode.span.start)),
            tnode.outType,
            tnode.childExpr[0]
          ))
        );
      }

      case PExprKind.STRUCT: {
        const tnode = node as PStruct;
        // convert positional fields into named fields. (adds a name in-place)
        let positional = true, changed = false;
        const seen: { [name: string]: boolean } = {};

        const newItems = transformCollection(tnode.items, (item, i) => {
          if (item.name === undefined) {
            if (!positional) errors.add("Positional fields can't come after named fields", item);
            changed = true;
            return new PStructField(
              identifier(`?${i}`, item.span.start),
              [ makeToken[TokenType.BIND](item.span.start) ],
              item.childExpr[0]
            );
          }
          positional = false;
          if (seen[item.name.value]) errors.add(`Field name '${item.name.value}' is repeated`, item);
          seen[item.name.value] = true;
          return item;
        });
        return changed ? new PStruct(newItems) : null;
      }

      case PExprKind.NEW: {
        // "new" must contain either an "on", or a block that contains at least one "on".
        const inner = node.childExpr[node.childExpr.length - 1];
        if (inner.nodeType != PExprKind.BLOCK && inner.nodeType != PExprKind.ON) {
          errors.add("'new' expression must contain at least one 'on' handler", node);
        }
        if (inner.nodeType == PExprKind.BLOCK) {
          const handlers = inner.childExpr.filter(n => n.nodeType == PExprKind.ON);
          if (handlers.length == 0) {
            errors.add("'new' expression must contain at least one 'on' handler", node);
          }
        }
        return null;
      }

      case PExprKind.UNARY: {
        // convert unary(op)(a) into call(a, op)
        const tnode = node as PUnary;
        return makeCall(
          tnode.childExpr[0],
          newSymbol(tnode.op.value == "-" ? "negative" : tnode.op.value, tnode.children[0].span.end)
        );
      }

      case PExprKind.BINARY: {
        // convert binary(logic-op)(a, b) into logic(logic-op)(a, b)
        const tnode = node as PBinary;
        if (tnode.op.tokenType.id == TokenType.OR || tnode.op.tokenType.id == TokenType.AND) {
          return new PLogic(tnode.childExpr[0], tnode.gap1, tnode.op, tnode.gap2, tnode.childExpr[1]);
        }
        // convert binary(op)(a, b) into call(call(a, op), b)
        return makeCall(
          makeCall(wrap(tnode.childExpr[0]), newSymbol(tnode.op.value, tnode.childExpr[0].span.end)),
          wrap(tnode.childExpr[1])
        );
      }

      case PExprKind.IF: {
        // ensure every "if" has an "else".
        if (node.childExpr.length < 3) {
          const tnode = node as PIf;
          const index = tnode.childExpr[1].span.end;
          return new PIf(
            tnode.ifToken, tnode.space1, tnode.childExpr[0], tnode.space2, tnode.thenToken, tnode.space3,
            tnode.childExpr[1], sp(index), makeToken[TokenType.ELSE](index), sp(index), nothing(index)
          );
        }
        return null;
      }

      case PExprKind.ASSIGNMENT: {
        if (node.parentExpr && node.parentExpr.nodeType != PExprKind.BLOCK) {
          errors.add("Mutable assignments may only occur inside a code block", node);
        }
        return null;
      }

      case PExprKind.BLOCK: {
        // convert one-expression block into that expression.
        if (
          node.childExpr.length == 1 &&
          [ PExprKind.LOCALS, PExprKind.ASSIGNMENT, PExprKind.ON ].indexOf(node.childExpr[0].nodeType) < 0
        ) return wrap(node.childExpr[0]);
        return null;
      }

      case PExprKind.WHILE: {
        // convert while(a, b) into if(a, repeat(block(local(?0, b), if(not(a), break(?0))))).
        const cond = node.childExpr[0], expr = node.childExpr[1];
        const newVar = nextLocal();
        const newLocal = makeLocal(identifier(newVar, expr.span.start), expr);
        const breakOut = makeIf(
          makeCall(cond, newSymbol("not", cond.span.end)),
          makeBreak(new PReference(identifier(newVar, cond.span.end)))
        );
        return makeIf(cond, makeRepeat(makeBlock(newLocal, breakOut)));
      }


//       case "POn": {
//         // must be inside a "new" block.
//         if (parentType(0) == "PNew" || (parentType(0) == "PBlock" && parentType(1) == "PNew")) {
//           return null;
//         } else {
//           errors.add("'on' handlers must be inside a 'new' expression", node.span);
//           return null;
//         }
//       }
//

//
//       // we allow statements everywhere in the parser, to make errors nicer. but here we check and redcard.
//       case "PLocals": {
//         if (parentType() != "PBlock") errors.add("Locals may only be defined inside a code block", node.span);
//         return null;
//       }
//
//
//       // "return" must be inside an "on" handler, and a block.
//       case "PReturn": {
//         if (path.filter(n => n.nodeType == "POn").length == 0) {
//           errors.add("'return' must be inside a function or handler", node.span);
//         }
//         return null;
//       }
//
//       // "break" must be inside a loop.
//       case "PBreak": {
//         if (path.filter(n => n.nodeType == "PRepeat").length == 0) {
//           errors.add("'break' must be inside a loop", node.span);
//         }
//         return null;
//       }

      default:
        return null;
    }
  });
}

function sp(index: number): Token {
  return tokenizer.token(TokenType.LINESPACE, new Span(index, index), " ");
}

function nothing(index: number): PConstant {
  return new PConstant(PConstantType.NOTHING, [ makeToken[TokenType.NOTHING](index) ]);
}

function identifier(name: string, index: number): Token {
  return tokenizer.token(TokenType.IDENTIFIER, new Span(index, index), name);
}

function newSymbol(name: string, index: number): PConstant {
  return new PConstant(PConstantType.SYMBOL, [ identifier(`.${name}`, index) ], name);
}

// put inside a PNested, to preserve precedence when dumping
function wrap(node: PExpr): PNested {
  return new PNested(
    makeToken[TokenType.OPAREN](node.span.start), [], node, [], makeToken[TokenType.CPAREN](node.span.end)
  );
}

function makeNew(type: PType | undefined, code: PExpr): PNew {
  const index = type === undefined ? code.span.start : type.span.start;
  return new PNew(
    makeToken[TokenType.NEW](index), sp(index), type, type === undefined ? undefined : sp(code.span.start), code
  );
}

function makeCall(a: PExpr, b: PExpr): PCall {
  return new PCall(a, sp(a.span.end), b);
}

function makeIf(cond: PExpr, ifTrue: PExpr, ifFalse?: PExpr): PIf {
  const fakeIf = makeToken[TokenType.IF](cond.span.start);
  const sp1 = sp(cond.span.start);
  const fakeThen = makeToken[TokenType.THEN](ifTrue.span.start);
  const sp2 = sp(ifTrue.span.start);
  if (ifFalse == undefined) return new PIf(fakeIf, sp1, cond, sp2, fakeThen, sp2, ifTrue);
  const fakeElse = makeToken[TokenType.ELSE](ifFalse.span.start);
  const sp3 = sp(ifFalse.span.start);
  return new PIf(fakeIf, sp1, cond, sp2, fakeThen, sp2, ifTrue, sp3, fakeElse, sp3, ifFalse);
}

function makeRepeat(expr: PExpr): PRepeat {
  return new PRepeat(makeToken[TokenType.REPEAT](expr.span.start), sp(expr.span.start), expr);
}

function makeBreak(expr: PExpr): PBreak {
  return new PBreak(makeToken[TokenType.BREAK](expr.span.start), sp(expr.span.start), expr);
}

function makeLocal(name: Token, value: PExpr): PLocals {
  const index = value.span.start;
  const newLocal = new PLocal(
    undefined, undefined, name, sp(index), makeToken[TokenType.BIND](index), sp(index), value
  );
  return new PLocals(
    makeToken[TokenType.LET](index), sp(index), [ new AnnotatedItem(newLocal, undefined, undefined, []) ]
  );
}

function makeHandler(receiver: PConstant | PType, type: PType | undefined, expr: PExpr): POn {
  return new POn(
    makeToken[TokenType.ON](receiver.span.start),
    sp(receiver.span.start),
    receiver,
    type === undefined ? undefined : makeToken[TokenType.COLON](type.span.start),
    type === undefined ? undefined : sp(type.span.start),
    type,
    sp(expr.span.start),
    makeToken[TokenType.ARROW](expr.span.start),
    sp(expr.span.start),
    expr
  );
}

// put expressions in a block
function makeBlock(...nodes: PExpr[]): PBlock {
  const list = nodes.map((expr, i) => {
    const last = i == nodes.length - 1;
    const index = expr.span.end;
    const semi = last ? undefined : makeToken[TokenType.SEMICOLON](index);
    return new AnnotatedItem(expr, undefined, semi, last ? [] : [ sp(index) ]);
  });
  const left = list[0].span.start;
  const right = list[list.length - 1].span.end;
  const collection = new TokenCollection<PExpr>(
    makeToken[TokenType.OBRACE](left),
    [ sp(left) ],
    list,
    [ sp(right) ],
    makeToken[TokenType.CBRACE](right)
  );
  return new PBlock(collection);
}

function transformCollection<A extends PExpr>(
  items: TokenCollection<A>,
  f: (item: A, index: number) => A
): TokenCollection<A> {
  const newList = items.list.map((item, i) => replaceAnnotatedItem(item, f(item.item, i)));
  return new TokenCollection(items.open, items.gap1, newList, items.gap2, items.close);
}

function replaceAnnotatedItem<A extends PExpr>(item: AnnotatedItem<A>, value: A): AnnotatedItem<A> {
  return new AnnotatedItem(value, item.gap1, item.separator, item.gap2);
}
