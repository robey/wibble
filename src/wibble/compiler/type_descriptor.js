"use strict";

import { dumpExpr } from "../dump";

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

  addSymbolHandler(name, type) {
    this.symbolHandlers[name] = type;
  }

  addTypeHandler(guard, type) {
    this.typeHandlers.push([ guard, type ]);
  }
}

export function newType(name) {
  return new TypeDescriptor(name);
}

export class CompoundType extends TypeDescriptor {
  // fields: [ PTypedField ]
  constructor(fields) {
    super(null);
    this.fields = fields;
    fields.forEach(f => this.addSymbolHandler(f.name, f.type));
  }

  inspect() {
    return "(" + this.fields.map(f => {
      return `${f.name}: ${f.type.inspect()}` + (f.value == null ? "" : ` = ${dumpExpr(f.value)}`);
    }).join(", ") + ")";
  }
}
