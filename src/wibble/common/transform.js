"use strict";

import { Errors } from "../common/errors";

/*
 * functions for transforming the AST
 */

export class PState {
  constructor() {
    // errors are cumulative.
    this.errors = new Errors();

    // fields set with set/get are collected down the tree from parent to child.
    this.layer = 0;
    this.stack = [];
    this.state = {};
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
  const newNode = transform(node, state) || node;
  newNode.children = newNode.children.map(n => transformAst(n, state, transform));
  state.pop();
  return newNode;
}
