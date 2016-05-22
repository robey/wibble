"use strict";

import { Errors } from "../common/errors";

/*
 * functions for transforming the AST
 */

/*
 * Track state as we walk through the AST, like errors, and the current path
 * to the root of the tree.
 */
export class PState {
  constructor() {
    // errors are cumulative.
    this.errors = new Errors();

    // keep breadcrumbs of the path we took to get to this node.
    this.path = [];

    // fields set with set/get are collected down the tree from parent to child.
    // FIXME: i think the existence of "path" makes this unnecessary.
    this.layer = 0;
    this.stack = [];
    this.state = {};
  }

  // return the Nth parent, where parent(0) is our direct parent.
  parent(n = 0) {
    if (n >= this.path.length) return null;
    return this.path[this.path.length - n - 1];
  }

  parentType(n = 0) {
    const parent = this.parent(n);
    return parent ? parent.constructor.name : "";
  }

  set(key, value) {
    if (this.layer > 0) {
      // lazily push the old state and start a new one.
      this.stack.push({ state: this.state, layer: this.layer });
      const state = {};
      for (const key in this.state) state[key] = this.state[key];
      this.state = state;
      this.layer = 0;
    }
    this.state[key] = value;
  }

  get(key) {
    return this.state[key];
  }

  push() {
    // be lazy. don't make a new scope unless we need it.
    this.layer++;
  }

  pop() {
    if (this.layer == 0) {
      const { state, layer } = this.stack.pop();
      this.state = state;
      this.layer = layer;
    }
    this.layer--;
  }
}

/*
 * transform may return null to mean "no change".
 */
export function transformAst(node, state, transform) {
  state.push();
  let newNode = node;
  do {
    node = newNode;
    newNode = transform(node, state);
  } while (newNode != null);
  state.path.push(node);
  node.children = node.children.map(n => transformAst(n, state, transform));
  state.path.pop();
  state.pop();
  return node;
}
