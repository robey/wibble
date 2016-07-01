"use strict";

export class CompileError extends Error {
  constructor(message, span) {
    super(message);
    this.span = span;
  }

  // don't bother adding methods here. seems to be a js bug.
}

export class Errors {
  constructor() {
    this.list = [];
  }

  add(message, span) {
    this.list.push(new CompileError(message, span));
  }

  get length() {
    return this.list.length;
  }

  inspect() {
    return this.list.map(error => {
      if (!error.span) return error.message;
      return `[${error.span.start}:${error.span.end}] ${error.message}`;
    }).join(", ");
  }

  // remember the set of errors we have so far, in cas we want to backtrack later.
  mark() {
    this._mark = this.list.length;
  }

  restore() {
    while (this.list.length > this._mark) this.list.pop();
  }

  haveIncreased() {
    return this.list.length > this._mark;
  }
}
