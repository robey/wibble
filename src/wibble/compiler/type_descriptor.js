"use strict";

import { dumpExpr } from "../dump";
import { PTypedField } from "../common/ast";

let _nextId = 1;

/*
 * Set of handlers that map a symbol or compound type to a return type.
 */
export class TypeDescriptor {
  // name is optional.
  constructor(name) {
    this.id = _nextId++;
    this.name = name;
    // typeHandlers: { guard, type }
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
    const types = this.typeHandlers.map(({ guard, type }) => `${guard.inspect()} -> ${type.inspect()}`);
    // shorthand for functions, which only have one handler:
    return symbols.length == 0 && types.length == 1 ? types[0] : ("[" + symbols.concat(types).join(", ") + "]");
  }

  addSymbolHandler(name, type) {
    this.symbolHandlers[name] = type;
  }

  addTypeHandler(guard, type) {
    this.typeHandlers.push({ guard, type });
  }

  /*
   * this is kind of a hack, but is only used to verify types that are
   * required by syntax, like: the shortcut boolean operators only work on
   * booleans.
   */
  isType(other) {
    return this.id == other.id;
  }

  canAssignFrom(other) {
    return this.isType(other);
  }

  handlerTypeForSymbol(name) {
    if (this.symbolHandlers[name] != null) return this.symbolHandlers[name];
    return null;
  }

  handlerTypeForMessage(inType) {
    const matches = this.typeHandlers.filter(({ guard }) => guard.canAssignFrom(inType));
    return matches.length == 0 ? { } : { coerceType: matches[0][0], type: matches[0][1] };
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

  canAssignFrom(other) {
    if (this.isType(other)) return true;
    if (other.nothing) {
      other = new CompoundType([]);
    } else if (!(other instanceof CompoundType)) {
      other = new CompoundType([ new PTypedField("?0", other) ]);
    }
    if (this.looselyMatches(other.fields)) return true;
    // special case: if we're a one-field struct that is itself a struct, we have to go deeper.
    if (this.fields.length == 1 && (this.fields[0].type instanceof CompoundType)) {
      if (this.fields[0].type.looselyMatches(other.fields)) return true;
    }
    return false;
  }

  /*
   * check for loose matching:
   *   - no extra fields
   *   - positional fields have the right type
   *   - all missing fields have default values
   */
  looselyMatches(fields) {
    const remaining = {};
    this.fields.forEach(f => {
      remaining[f.name] = f;
    });
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      let name = f.name;
      if (name[0] == "?") {
        // positional.
        if (i >= this.fields.length) return false;
        name = this.fields[i].name;
      }
      if (remaining[name] == null) return false;
      if (!remaining[name].type.canAssignFrom(f.type)) return false;
      delete remaining[name];
    }
    for (const name in remaining) if (remaining[name].defaultValue == null) return false;
    return true;
  }
}

//
//
// canCoerceFrom: (other, parameterMap = {}) ->
//   @coercionKind(other, parameterMap)?
//
// # (only for structs) figure out what kind of coercion will work, and return it
// coercionKind: (other, parameterMap = {}) ->
//   other = other.flatten()
//   kind = null
//   # allow zero-arg to be equivalent to an empty struct, and one-arg to be a single-element struct
//   if other instanceof CompoundType
//     kind = "compound"
//   else
//     if other.equals(new NamedType("Nothing"))
//       kind = "nothing"
//       other = new CompoundType([])
//     else
//       kind = "single"
//       other = new CompoundType([ name: "?0", type: other ])
//   # check loose equality of compound types
//   if @equals(other) then return kind
//   if @looselyMatches(other.fields, parameterMap) then return kind
//   # special case: if we're a one-field struct that is itself a struct, we have to go deeper.
//   if @fields.length == 1 and (@fields[0].type instanceof CompoundType) and @fields[0].type.looselyMatches(other.fields, parameterMap) then return "nested"
//   null
//
