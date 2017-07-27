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
  PIf,
  PLocal,
  PLocals,
  PLogic,
  PNested,
  PNew,
  PNode,
  PNodeExpr,
  PNodeInjected,
  PNodeType,
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
import { TokenType } from "../parser/p_tokens";
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
  function nextLocal(): PReference {
    return new PReference(inject(`_${generateIndex++}`));
  }


//   // keep breadcrumbs of the path we took to get to this node.
//   const path = [];
//   function parentType(n = 0) {
//     if (n >= path.length) return "";
//     return path[path.length - n - 1].nodeType;
//   }

  return transformAst(ast, node => {
    switch (node.nodeType) {

      case PNodeType.FUNCTION: {
        // convert function(inType?, outType?, a) into new(on(inType, a, outType))
        let inType: PType | undefined = undefined;
        let outType: PType | undefined = undefined;
        let expr = node.childExpr[0];
        if (node.childExpr.length > 1) {
          inType = node.childExpr[0];
          expr = node.childExpr[1];
          if (node.childExpr.length > 2) {
            outType = node.childExpr[1];
            expr = node.childExpr[2];
          }
        }
        return makeNew(undefined, makeBlock(makeHandler(inType || new PEmptyType(openclose), outType, expr)));
      }

      case PNodeType.STRUCT: {
        const tnode = node as PStruct;
        // convert positional fields into named fields. (adds a name in-place)
        let positional = true, changed = false;
        const seen: { [name: string]: boolean } = {};

        const newItems = transformCollection(tnode.items, (item, i) => {
          if (item.name === undefined) {
            if (!positional) errors.add("Positional fields can't come after named fields", item);
            changed = true;
            return new PStructField(inject(`?${i}`), [ eq ], item.childExpr[0]);
          }
          positional = false;
          if (seen[item.name.source]) errors.add(`Field name '${item.name.source}' is repeated`, item);
          seen[item.name.source] = true;
          return item;
        });
        return changed ? new PStruct(newItems) : null;
      }

      case PNodeType.NEW: {
        // "new" must contain either an "on", or a block that contains at least one "on".
        const inner = node.childExpr[node.childExpr.length - 1];
        if (inner.nodeType != PNodeType.BLOCK && inner.nodeType != PNodeType.ON) {
          errors.add("'new' expression must contain at least one 'on' handler", node);
        }
        if (inner.nodeType == PNodeType.BLOCK) {
          const handlers = inner.childExpr.filter(n => n.nodeType == PNodeType.ON);
          if (handlers.length == 0) {
            errors.add("'new' expression must contain at least one 'on' handler", node);
          }
        }
        return null;
      }

      case PNodeType.UNARY: {
        // convert unary(op)(a) into call(a, op)
        const tnode = node as PUnary;
        return makeCall(tnode.childExpr[0], newSymbol(tnode.op.source == "-" ? "negative" : tnode.op.source));
      }

      case PNodeType.BINARY: {
        // convert binary(logic-op)(a, b) into logic(logic-op)(a, b)
        const tnode = node as PBinary;
        if (tnode.op.tokenType.id == TokenType.OR || tnode.op.tokenType.id == TokenType.AND) {
          return new PLogic(tnode.childExpr[0], tnode.gap1, tnode.op, tnode.gap2, tnode.childExpr[1]);
        }
        // convert binary(op)(a, b) into call(call(a, op), b)
        return makeCall(
          makeCall(wrap(tnode.childExpr[0]), newSymbol(tnode.op.value)),
          wrap(tnode.childExpr[1])
        );
      }

      case PNodeType.IF: {
        // ensure every "if" has an "else".
        if (node.childExpr.length < 3) {
          const tnode = node as PIf;
          const elseToken = [ sp, fakeElse, sp ];
          return new PIf(tnode.ifToken, tnode.childExpr[0], tnode.thenToken, tnode.childExpr[1], elseToken, nothing);
        }
        return null;
      }

      case PNodeType.ASSIGNMENT: {
        if (node.parentExpr && node.parentExpr.nodeType != PNodeType.BLOCK) {
          errors.add("Mutable assignments may only occur inside a code block", node);
        }
        return null;
      }

      case PNodeType.BLOCK: {
        // convert one-expression block into that expression.
        if (
          node.childExpr.length == 1 &&
          [ PNodeType.LOCALS, PNodeType.ASSIGNMENT, PNodeType.ON ].indexOf(node.childExpr[0].nodeType) < 0
        ) return wrap(node.childExpr[0]);
        return null;
      }

      case PNodeType.WHILE: {
        // convert while(a, b) into if(a, repeat(block(local(?0, b), if(not(a), break(?0))))).
        const newVar = nextLocal();
        const newLocal = makeLocal(newVar, node.childExpr[1]);
        const breakOut = makeIf(makeCall(node.childExpr[0], newSymbol("not")), makeBreak(newVar));
        return makeIf(node.childExpr[0], makeRepeat(makeBlock(newLocal, breakOut)));
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

function inject(text: string): PNode {
  return new PNodeInjected(text);
}

const sp = inject(" ");
const colon = inject(":");
const semi = inject(";");
const eq = inject("=");
const arrow = inject("->");
const openclose = inject("()");
const obrace = inject("{");
const cbrace = inject("}");
const fakeNew = inject("new");
const fakeIf = inject("if");
const fakeThen = inject("then");
const fakeElse = inject("else");
const fakeRepeat = inject("repeat");
const fakeBreak = inject("break");
const fakeLet = inject("let");
const fakeOn = inject("on");

const nothing = new PConstant(PConstantType.NOTHING, [ openclose ]);

function newSymbol(name: string): PConstant {
  return new PConstant(PConstantType.SYMBOL, [ inject(`.${name}`) ], name);
}

// put inside a PNested, to preserve precedence when dumping
function wrap(node: PNodeExpr): PNested {
  return new PNested(inject("("), [], node, [], inject(")"));
}

function makeNew(type: PType | undefined, code: PNodeExpr): PNew {
  return new PNew(fakeNew, sp, type, type === undefined ? undefined : sp, code);
}

function makeCall(a: PNodeExpr, b: PNodeExpr): PCall {
  return new PCall(a, sp, b);
}

function makeIf(cond: PNodeExpr, ifTrue: PNodeExpr, ifFalse?: PNodeExpr): PIf {
  const elseToken = ifFalse === undefined ? [] : [ sp, fakeElse, sp ];
  return new PIf([ fakeIf, sp ], cond, [ sp, fakeThen, sp ], ifTrue, elseToken, ifFalse);
}

function makeRepeat(expr: PNodeExpr): PRepeat {
  return new PRepeat(fakeRepeat, sp, expr);
}

function makeBreak(expr: PNodeExpr): PBreak {
  return new PBreak([ fakeBreak, sp ], expr);
}

function makeLocal(name: PReference, value: PNodeExpr): PLocals {
  const newLocal = new PLocal([], name.token, [ sp, eq, sp ], value);
  return new PLocals(fakeLet, sp, [ new AnnotatedItem(newLocal, undefined, undefined, []) ]);
}

function makeHandler(receiver: PNodeExpr, type: PType | undefined, expr: PNodeExpr): POn {
  return new POn([ fakeOn, sp ], receiver, type === undefined ? [] : [ colon, sp ], type, [ sp, arrow, sp ], expr);
}

// put expressions in a block
function makeBlock(...nodes: PNodeExpr[]): PBlock {
  const list = nodes.map((expr, i) => {
    const last = i == nodes.length - 1;
    return new AnnotatedItem(expr, undefined, last ? undefined : semi, last ? [] : [ sp ]);
  });
  const collection = new TokenCollection<PNodeExpr>(obrace, [ sp ], list, [ sp ], cbrace);
  return new PBlock(collection);
}

function transformCollection<A extends PNodeExpr>(
  items: TokenCollection<A>,
  f: (item: A, index: number) => A
): TokenCollection<A> {
  const newList = items.list.map((item, i) => replaceAnnotatedItem(item, f(item.item, i)));
  return new TokenCollection(items.open, items.gap1, newList, items.gap2, items.close);
}

function replaceAnnotatedItem<A extends PNodeExpr>(item: AnnotatedItem<A>, value: A): AnnotatedItem<A> {
  return new AnnotatedItem(value, item.gap1, item.separator, item.gap2);
}
