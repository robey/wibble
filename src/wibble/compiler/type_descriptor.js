"use strict";

let _nextId = 1;

/*
 * Set of handlers that map a symbol or compound type to a return type.
 */
export class TypeDescriptor {
  // name is optional.
  constructor(name) {
    this.id = _nextId++;
    this.name = name;
    this.typeHandlers = [];
    this.symbolHandlers = {};
  }

  inspect() {
    return this.name == null ? this.describe() : this.name;
  }

  describe() {
    const symbols = Object.keys(this.symbolHandlers).forEach(key => {
      return `.${key} -> ${this.symbolHandlers[key].inspect()}`;
    });
    const types = this.typeHandlers.map(([ guard, type ]) => `${guard.inspect()} -> ${type.inspect()}`);
    // shorthand for functions, which only have one handler:
    return symbols.length == 0 && types.length == 1 ? types[0] : ("[" + symbols.concat(types).join(", ") + "]");
  }
}
