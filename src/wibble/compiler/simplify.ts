// "use strict";
//
// import {
//   PBlock, PBreak, PCall, PConstant, PConstantType, PIf, PLocal, PLocals,
//   PLogic, PNew, POn, PReference, PRepeat, PUnary
// } from "../common/ast";
// import { transformAst } from "../common/transform";

import { Span, Token } from "packrattle";
import {
  PBinary, PCall, PConstant, PConstantType, PIf, PLogic, PNested, PNode, PNodeExpr, PNodeInjected, PNodeType, PUnary
} from "../common/ast";
import { Errors } from "../common/errors";
import { TokenType } from "../parser/p_tokens";
import { transformAst } from "../common/transform";

/*
 * perform some basic simplifications and error checks on the parse tree,
 * before type-checking.
 */
export function simplify(ast: PNode, errors: Errors) {
//   /*
//    * assign new variable names starting with '_' (which is not allowed by
//    * user-written code).
//    */
//   let generateIndex = 0;
//   function nextLocal(span) {
//     return new PReference(`_${generateIndex++}`, span);
//   }
//
//   // keep breadcrumbs of the path we took to get to this node.
//   const path = [];
//   function parentType(n = 0) {
//     if (n >= path.length) return "";
//     return path[path.length - n - 1].nodeType;
//   }

  return transformAst(ast, node => {
    switch (node.nodeType) {
      case PNodeType.UNARY: {
        // convert unary(op)(a) into call(a, op)
        const tnode = node as PUnary;
        const op = tnode.op.tokenType.id == TokenType.MINUS ? "negative" : tnode.op.value;
        return new PCall(tnode.childExpr[0], new PNodeInjected(" "), newSymbol(op));
      }

      case PNodeType.BINARY: {
        // convert binary(logic-op)(a, b) into logic(logic-op)(a, b)
        const tnode = node as PBinary;
        if (tnode.op.tokenType.id == TokenType.OR || tnode.op.tokenType.id == TokenType.AND) {
          return new PLogic(tnode.childExpr[0], tnode.gap1, tnode.op, tnode.gap2, tnode.childExpr[1]);
        }
        // convert binary(op)(a, b) into call(call(a, op), b)
        return new PCall(
          new PCall(wrap(tnode.childExpr[0]), new PNodeInjected(" "), newSymbol(tnode.op.value)),
          new PNodeInjected(" "),
          wrap(tnode.childExpr[1])
        );
      }

      case PNodeType.IF: {
        // ensure every "if" has an "else".
        if (node.childExpr.length < 3) {
          const tnode = node as PIf;
          const elseToken = [ new PNodeInjected(" else ") ];
          const nothing = new PConstant(PConstantType.NOTHING, [ new PNodeInjected("()") ]);
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
        ) return node.childExpr[0];
        return null;
      }


//       case "PWhile": {
//         // convert while(a, b) into if(a, repeat(block(local(?0, b), if(not(a), break(?0))))).
//         const newVar = nextLocal(node.span);
//         const breakOut = new PIf(
//           new PUnary("not", node.children[0], node.children[0].span),
//           new PBreak(newVar, node.span),
//           null,
//           node.span
//         );
//         const newLocal = new PLocal(newVar.name, node.children[1], node.children[1].span, false);
//         const block = new PBlock([ new PLocals(node.span, [ newLocal ], false), breakOut ], null, node.span);
//         return new PIf(node.children[0], new PRepeat(block, node.span), null, node.span);
//       }
//
//       case "PStruct": {
//         // convert positional fields into named fields. (adds a name in-place)
//         let positional = true;
//         const seen = {};
//
//         node.children.forEach((field, i) => {
//           if (field.name == null) {
//             if (!positional) errors.add("Positional fields can't come after named fields", field.span);
//             field.name = `?${i}`;
//           } else {
//             positional = false;
//             if (seen[field.name]) errors.add(`Field name '${field.name}' is repeated`, field.span);
//             seen[field.name] = true;
//           }
//         });
//         return null;
//       }
//
//       case "PFunction": {
//         // convert function(inType, a, outType) into new(on(inType, a, outType)).
//         return new PNew(new POn(node.children[0], node.children[1], node.children[2], node.span), null, node.span);
//       }
//
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
//       case "PNew": {
//         // "new" must contain either an "on", or a block that contains at least one "on".
//         const inner = node.children[0].nodeType;
//         if (inner != "PBlock" && inner != "POn") {
//           errors.add("'new' expression must contain at least one 'on' handler", node.span);
//         }
//         if (inner == "PBlock") {
//           const handlers = node.children[0].children.filter(n => n.nodeType == "POn");
//           if (handlers.length == 0) {
//             errors.add("'new' expression must contain at least one 'on' handler", node.span);
//           }
//         }
//         return null;
//       }
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

function newSymbol(name: string): PConstant {
  const source = [ new PNodeInjected(`.${name}`) ];
  return new PConstant(PConstantType.SYMBOL, source, name);
}

// put inside a PNested, to preserve precedence when dumping
function wrap(node: PNodeExpr): PNodeExpr {
  return new PNested(new PNodeInjected("("), [], node, [], new PNodeInjected(")"));
}
