import { PNode, PNodeExpr } from "./ast";

/*
 * walk the AST (depth-first), optionally transforming each expression node as you go.
 */
export function transformAst(node: PNode, transform: (node: PNodeExpr) => (PNodeExpr | null)): PNode {
  if (node instanceof PNodeExpr) {
    let newNode: PNodeExpr | null = node;
    do {
      node = newNode;
      newNode = transform(node as PNodeExpr);
    } while (newNode != null);
  }

  if (node.expr.length > 0) {
//     if (options.enter) options.enter(node);
    node.replaceChildren(node.children.map(x => {
      return transformAst(x, transform);
    }));
    // if (options.exit) options.exit(node);
  }

  return node;
}

/*
 * - node: where to start
 * - options:
 *     - enter(node): called right before children of this node are
 *         traversed
 *     - exit(node): called right after children are traversed
 *     - postpone: list of node types; when traversing children, nodes of
 *         these types will be done after the other children have finished
 * - transform(node): returns null to leave the node as-is; otherwise,
 *     returns a new node. the new node will replace this node, and will be
 *     sent back to transform until the transforms are all complete (null is
 *     returned).
 * - lateTransform(node): (optional) transform a node _after_ all of the
 *     child nodes have been traversed
 */
// export function transformAst(node, options = {}, transform, lateTransform) {
//   if (transform == null) {
//     transform = options;
//     options = {};
//   }
//
//   let newNode = node;
//   do {
//     node = newNode;
//     newNode = transform(node);
//   } while (newNode != null);
//
//   if (node.children.length > 0) {
//     if (options.enter) options.enter(node);
//     node.children = node.children.map(n => {
//       const nodeType = n.constructor.name;
//       const shouldPostpone = options.postpone && options.postpone.indexOf(nodeType) >= 0;
//       return shouldPostpone ? n : transformAst(n, options, transform, lateTransform);
//     });
//     if (options.postpone) {
//       node.children = node.children.map(n => {
//         const nodeType = n.constructor.name;
//         return options.postpone.indexOf(nodeType) >= 0 ? transformAst(n, options, transform, lateTransform) : n;
//       });
//     }
//     if (options.exit) options.exit(node);
//   }
//
//   if (lateTransform) {
//     let newNode = node;
//     do {
//       node = newNode;
//       newNode = lateTransform(node);
//     } while (newNode != null);
//   }
//
//   return node;
// }
