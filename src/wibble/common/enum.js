"use strict";

/*
 * construct an enum string values, giving each a unique int.
 */
export default class Enum {
  constructor(values) {
    let counter = 1;
    this._names = [];
    values.forEach(v => {
      this[v] = counter;
      this._names[counter] = v;
      counter++;
    });
  }

  name(n) {
    return this._names[n] || "(unknown)";
  }

  inspect() {
    return "Enum(" + this._names.slice(1).map(name => `${name} = ${this[name]}`).join(", ") + ")";
  }
}