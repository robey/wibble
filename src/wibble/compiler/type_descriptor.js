"use strict";

import { dumpExpr } from "../dump";

const ARROW_RIGHT = "\u2192";

let _nextId = 1;

/*
 * Set of handlers that map a symbol or compound type to a return type.
 */
export class TypeDescriptor {
  // name is optional.
  constructor(name) {
    this.id = _nextId++;
    this.name = name;
    // for inspect:
    this.precedence = 1;
    // typeHandlers: { guard, type }
    this.typeHandlers = [];
    this.symbolHandlers = {};
    // override to refuse handler lookups:
    this.canCall = true;
    // are there any wildcards? (in other words, not fully defined)
    this.wildcards = [];
  }

  inspect(seen = {}, precedence = 100) {
    if (this.name != null) return this.name;
    if (seen[this.id]) return "@";
    seen[this.id] = true;
    const rv = this._inspect(seen, precedence);
    seen[this.id] = false;
    return rv;
  }

  _inspect(seen, precedence) {
    // default implementation: describe interface.
    const symbols = Object.keys(this.symbolHandlers).map(key => {
      return `.${key} -> ${this.symbolHandlers[key].inspect(seen, 2)}`;
    });
    const types = this.typeHandlers.map(({ guard, type }) => `${guard.inspect(seen, 9)} -> ${type.inspect(seen, 2)}`);

    // hack to make functions print out with nicer style.
    const isFunction = symbols.length == 0 && types.length == 1;
    const myPrecedence = isFunction ? this.precedence + 1 : this.precedence;

    const description = isFunction ? types[0] : ("{ " + symbols.concat(types).join(", ") + " }");
    return myPrecedence > precedence ? "(" + description + ")" : description;
  }

  addSymbolHandler(name, type) {
    this.symbolHandlers[name] = type;
    type.wildcards.forEach(w => {
      if (this.wildcards.indexOf(w) < 0) this.wildcards.push(w);
    });
  }

  addTypeHandler(guard, type) {
    this.typeHandlers.push({ guard, type });
    guard.wildcards.concat(type.wildcards).forEach(w => {
      if (this.wildcards.indexOf(w) < 0) this.wildcards.push(w);
    });
  }

  /*
   * some types are placeholders for type-checking work. when they resolve,
   * they have a reference to the real type.
   */
  get resolved() {
    return this;
  }

  /*
   * this is kind of a hack, but is only used to verify types that are
   * required by syntax, like: the shortcut boolean operators only work on
   * booleans.
   */
  isType(other) {
    return this.id == other.id;
  }

  /*
   * does every handler have a matching handler in the other type?
   *   - cache: [ [ left, right ] ] matches already made or in progress
   *       (to avoid infinite recursion)
   *   - wildcardMap: { name -> type } if the assignment can succeed by
   *       filling in some (`$A`) wildcard types
   */
  canAssignFrom(other, cache = [], wildcardMap = {}) {
    if (this.isType(other)) return true;  // shortcut
    for (let i = 0; i < cache.length; i++) {
      if (this.isType(cache[i][0]) && other.isType(cache[i][1])) return true;
    }

    // avoid recursing forever:
    cache.push([ this, other ]);

    for (const symbol in this.symbolHandlers) {
      const otherType = other.symbolHandlers.hasOwnProperty(symbol) ? other.symbolHandlers[symbol] : null;
      if (otherType == null || !this.symbolHandlers[symbol].canAssignFrom(otherType)) return false;
    }

    for (let i = 0; i < this.typeHandlers.length; i++) {
      const matches = other.typeHandlers.filter(h => {
        // arg coercion is contravariant, so it has to be compared in the opposite direction.
        return h.guard.canAssignFrom(this.typeHandlers[i].guard, cache, wildcardMap) &&
          this.typeHandlers[i].type.canAssignFrom(h.type, cache, wildcardMap);
      });
      if (matches.length < 1) return false;
    }

    return true;
  }

  handlerTypeForSymbol(name) {
    if (this.symbolHandlers.hasOwnProperty(name)) return this.symbolHandlers[name];
    return null;
  }

  handlerTypeForMessage(inType) {
    const wildcardMap = {};
    const matches = this.typeHandlers.filter(({ guard }) => guard.canAssignFrom(inType, [], wildcardMap));
    if (matches.length == 0) return {};
    console.log("-> match:", matches[0].guard.inspect(), matches[0].type.inspect());
    const guard = matches[0].guard.withWildcardMap(wildcardMap);
    const type = matches[0].type.withWildcardMap(wildcardMap);
    console.log("-> post wildcard:", guard.inspect(), type.inspect());
    return { coerceType: guard, type };
  }

  // fill in any wildcard types from the map
  withWildcardMap(wildcardMap) {
    if (this.wildcards.length == 0) return this;
    const rtype = new TypeDescriptor(this.name);
    for (const symbol in this.symbolHandlers) {
      rtype.symbolHandlers[symbol] = this.symbolHandlers[symbol].withWildcardMap(wildcardMap);
    }
    rtype.typeHandlers = this.typeHandlers.map(({ guard, type }) => {
      return { guard: guard.withWildcardMap(wildcardMap), type: type.withWildcardMap(wildcardMap) };
    });
    rtype.wildcards = this.wildcards.filter(w => wildcardMap[w] == null);
    return rtype;
  }
}


export class CTypedField {
  constructor(name, type, defaultValue) {
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
  }

  inspect(seen) {
    return `${this.name}: ${this.type.inspect(seen, 9)}` +
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

  _inspect(seen) {
    return "(" + this.fields.map(f => f.inspect(seen, 9)).join(", ") + ")";
  }

  canAssignFrom(other, cache = [], wildcardMap = {}) {
    if (this.isType(other)) return true;
    if (other.nothing) {
      other = new CompoundType([]);
    } else if (!(other instanceof CompoundType)) {
      other = new CompoundType([ new CTypedField("?0", other) ]);
    }
    if (this.looselyMatches(other.fields, cache, wildcardMap)) return true;
    // special case: if we're a one-field struct that is itself a struct, we have to go deeper.
    if (this.fields.length == 1 && (this.fields[0].type instanceof CompoundType)) {
      if (this.fields[0].type.looselyMatches(other.fields, cache, wildcardMap)) return true;
    }
    return false;
  }

  /*
   * check for loose matching:
   *   - no extra fields
   *   - positional fields have the right type
   *   - all missing fields have default values
   */
  looselyMatches(fields, cache, wildcardMap) {
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
      if (!remaining[name].type.canAssignFrom(f.type, cache, wildcardMap)) return false;
      delete remaining[name];
    }
    for (const name in remaining) if (remaining[name].defaultValue == null) return false;
    return true;
  }

  withWildcardMap(wildcardMap) {
    if (this.wildcards.length == 0) return this;
    const fields = this.fields.map(f => new CTypedField(f.name, f.type.withWildcardMap(wildcardMap), f.defaultValue));
    return new CompoundType(fields);
  }
}


export class ParameterType extends TypeDescriptor {
  constructor(name) {
    super(name);
    this.canCall = false;
  }

  canAssignFrom(other, cache = [], wildcardMap = {}) {
    // i'm a wildcard! i can coerce anything! tag, you're it!
    wildcardMap[this.name] = other;
    return true;
  }

  withWildcardMap(wildcardMap) {
    if (wildcardMap.hasOwnProperty(this.name)) return wildcardMap[this.name];
    return this;
  }
}


// export class TemplateType extends TypeDescriptor {
//   constructor(name, parameters) {
//     super(name);
//   }
//
//   canAssignFrom(other) {
//
//   }
//
//   _inspect(seen, precedence) {
//
//   }
// }


export class MergedType extends TypeDescriptor {
  constructor(types) {
    super();
    this.precedence = 3;
    this.types = types;
    this.canCall = false;
  }

  _inspect(seen, precedence) {
    const rv = this.types.map(t => t.inspect(seen, this.precedence)).join(" | ");
    return this.precedence > precedence ? "(" + rv + ")" : rv;
  }

  withWildcardMap(wildcardMap) {
    return mergeTypes(this.types.map(t => t.withWildcardMap(wildcardMap)));
  }
}


export function mergeTypes(types, logger) {
  // flatten list of types.
  const list = [].concat.apply([], types.map(type => {
    return (type.constructor.name == "MergedType") ? type.types : [ type ];
  })).filter(t => !t.isType(NoType));

  // perform N**2 unification: reduce to the minimum set of types.
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (!list[i] || !list[j]) continue;
      if (list[i].isType(list[j])) {
        list[j] = null;
        continue;
      }

      // can't merge wildcard types unless they're identical
      if (list[i] instanceof ParameterType || list[j] instanceof ParameterType) {
        if (list[i].name == list[j].name) list[j] = null;
        continue;
      }

      if (list[i].canAssignFrom(list[j])) {
        if (logger) logger(`${list[i].inspect()} can assign from ${list[j].inspect()}`);
        list[j] = null;
      } else if (list[j].canAssignFrom(list[i])) {
        if (logger) logger(`${list[j].inspect()} can assign from ${list[i].inspect()}`);
        list[i] = null;
      }
    }
  }

  const uniques = list.filter(t => t != null);
  const rv = uniques.length == 1 ? uniques[0] : new MergedType(uniques);
  if (logger) logger(`merge types: ${types.map(t => t.inspect()).join(" | ")} ${ARROW_RIGHT} ${rv.inspect()}`);
  return rv;
}

export function newType(name) {
  return new TypeDescriptor(name);
}

// special type for tracking 'return' in blocks:
export const NoType = newType("(none)");
