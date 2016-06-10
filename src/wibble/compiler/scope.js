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
    this.init = null;
    this.finishedInit = false;
  }

  // allow a lazy init function to be called before any get()/add() is done.
  setInit(f) {
    this.init = f;
    this.finishedInit = false;
  }

  push() {
    return new Scope(this);
  }

  get(name) {
    if (!this.finishedInit) {
      this.finishedInit = true;
      if (this.init) this.init();
    }
    if (this.symtab[name] != null) return this.symtab[name];
    if (this.parent != null) return this.parent.get(name);
    return null;
  }

  add(name, obj) {
    if (!this.finishedInit) {
      this.finishedInit = true;
      if (this.init) this.init();
    }
    this.symtab[name] = obj;
  }

  forEach(f) {
    Object.keys(this.symtab).sort().forEach(f);
  }

  inspect() {
    const keys = Object.keys(this.symtab).sort().join(", ");
    return "Scope(" + keys + (this.parent == null ? "" : ` ${ARROW_RIGHT} ${this.parent.inspect()}`) + ")";
  }
}
