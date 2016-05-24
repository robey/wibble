"use strict";

/*
 * walk the AST (depth-first), optionally transforming each node as you go.
 *
 * - node: where to start
 * - options:
 *     - enter(node): called right before children of this node are
 *         traversed
 *     - exit(node): called right after children are traversed
 * - transform(node): returns null to leave the node as-is; otherwise,
 *     returns a new node. the new node will replace this node, and will be
 *     sent back to transform until the transforms are all complete (null is
 *     returned).
 */
export function transformAst(node, options = {}, transform) {
  if (transform == null) {
    transform = options;
    options = {};
  }

  let newNode = node;
  do {
    node = newNode;
    newNode = transform(node);
  } while (newNode != null);

  if (node.children.length > 0) {
    if (options.enter) options.enter(node);
    node.children = node.children.map(n => transformAst(n, options, transform));
    if (options.exit) options.exit(node);
  }

  return node;
}
