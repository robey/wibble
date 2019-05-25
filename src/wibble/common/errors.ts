import { PNode } from "./ast";

export class CompileError extends Error {
  constructor(public message: string, public node: PNode) {
    super(message);
  }

  // don't bother adding methods here. seems to be a js bug.
}

export class Errors {
  public list: CompileError[] = [];
  private _mark: number = 0;

  constructor() {
    // pass
  }

  add(message: string, node: PNode) {
    this.list.push(new CompileError(message, node));
  }

  get length() {
    return this.list.length;
  }

  inspect() {
    return this.list.map(error => {
      if (!error.node) return error.message;
      return `[${error.node.span.start}:${error.node.span.end}] ${error.message}`;
    }).join(", ");
  }

  // remember the set of errors we have so far, in case we want to backtrack later.
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
