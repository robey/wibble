"use strict";

const ARROW_RIGHT = "\u2192";


/*
 * Lexically-scoped anything, resolved through a chain of links back up to
 * the root.
 *
 * The compiler uses this to map locals to types.
 */
export class Scope {
  constructor(parent) {
    this.parent = parent;
    this.symtab = {};
  }

  push() {
    return new Scope(this);
  }

  get(name) {
    if (this.symtab[name] != null) return this.symtab[name];
    if (this.parent != null) return this.parent.get(name);
    return null;
  }

  add(name, obj) {
    this.symtab[name] = obj;
  }

  inspect() {
    const keys = Object.keys(this.symtab).sort().join(", ");
    return "Scope(" + keys + (this.parent == null ? "" : ` ${ARROW_RIGHT} ${this.parent.inspect()}`) + ")";
  }
}
