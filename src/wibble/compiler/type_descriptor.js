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
    // typeHandlers: { guard, type }
    this.typeHandlers = [];
    this.symbolHandlers = {};
  }

  inspect() {
    return this.name == null ? this.describe() : this.name;
  }

  inspectNested() {
    if (this.name == null && Object.keys(this.symbolHandlers).length == 0 && this.typeHandlers.length == 1) {
      return "(" + this.inspect() + ")";
    }
    return this.inspect();
  }

  describe() {
    const symbols = Object.keys(this.symbolHandlers).map(key => {
      return `.${key} -> ${this.symbolHandlers[key].inspect()}`;
    });
    const types = this.typeHandlers.map(({ guard, type }) => `${guard.inspect()} -> ${type.inspect()}`);
    // shorthand for functions, which only have one handler:
    return symbols.length == 0 && types.length == 1 ? types[0] : ("{ " + symbols.concat(types).join(", ") + " }");
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

  // does every handler have a matching handler in the other type?
  canAssignFrom(other, cache = []) {
    if (this.isType(other)) return true;  // shortcut
    for (let i = 0; i < cache.length; i++) {
      if (this.isType(cache[i][0]) && other.isType(cache[i][1])) return true;
    }

    // avoid recursing forever:
    cache.push([ this, other ]);

    for (const symbol in this.symbolHandlers) {
      const otherType = other.symbolHandlers[symbol];
      if (otherType == null || !this.symbolHandlers[symbol].canAssignFrom(otherType)) return false;
    }

    for (let i = 0; i < this.typeHandlers.length; i++) {
      const matches = other.typeHandlers.filter(h => {
        // arg coercion is contravariant, so it has to be compared in the opposite direction.
        return h.guard.canAssignFrom(this.typeHandlers[i].guard, cache) &&
          this.typeHandlers[i].type.canAssignFrom(h.type, cache);
      });
      if (matches.length < 1) return false;
    }

    return true;
  }

  handlerTypeForSymbol(name) {
    if (this.symbolHandlers[name] != null) return this.symbolHandlers[name];
    return null;
  }

  handlerTypeForMessage(inType) {
    const matches = this.typeHandlers.filter(({ guard }) => guard.canAssignFrom(inType));
    return matches.length == 0 ? { } : { coerceType: matches[0].guard, type: matches[0].type };
  }
}

export function newType(name) {
  return new TypeDescriptor(name);
}


export class CTypedField {
  constructor(name, type, defaultValue) {
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
  }

  inspect() {
    return `${this.name}: ${this.type.inspect()}` +
      (this.defaultValue == null ? "" : ` = ${dumpExpr(this.defaultValue)}`);
  }
}

export class CompoundType extends TypeDescriptor {
  // fields: [ CTypedField ]
  constructor(fields) {
    super(null);
    this.fields = fields;
    fields.forEach(f => this.addSymbolHandler(f.name, f.type));
  }

  inspect() {
    return "(" + this.fields.map(f => f.inspect()).join(", ") + ")";
  }

  inspectNested() {
    return this.inspect();
  }

  canAssignFrom(other) {
    if (this.isType(other)) return true;
    if (other.nothing) {
      other = new CompoundType([]);
    } else if (!(other instanceof CompoundType)) {
      other = new CompoundType([ new CTypedField("?0", other) ]);
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


export class ParameterType extends TypeDescriptor {
  constructor(name) {
    super(name);
  }

  canAssignFrom(other) {
    // FIXME
    other;
    // # i'm a wildcard! i can coerce anything! tag, you're it!
    // parameterMap[@name] = other
  }
}


export class MergedType extends TypeDescriptor {
  constructor(types) {
    super();
    this.types = types;
  }

  inspect() {
    return this.types.map(t => t.inspectNested()).join(" | ");
  }
}


// # try to unify.
// mergeIfPossible: ->
//   for i in [0 ... @options.length]
//     for j in [i + 1 ... @options.length]
//       continue unless @options[i]? and @options[j]?
//       if @options[i].equals(@options[j])
//         @options[j] = null
//         continue
//       continue if @options[i] instanceof ParameterType
//       if @options[i].canCoerceFrom(@options[j])
//         @options[j] = null
//       else if @options[j].canCoerceFrom(@options[i])
//         @options[i] = null
//   types = @options.filter (x) -> x?
//   if types.length == 1 then types[0] else new DisjointType(types)





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
