"use strict";

import { dumpExpr } from "../dump";

const ARROW_RIGHT = "\u2192";

let _nextId = 1;

/*
 * Set of handlers that map a symbol or compound type to a return type.
 */
export class TypeDescriptor {
  /*
   * name: optional (user-defined types have one)
   * parameters: list of "$A" to fill in later (if possible)
   */
  constructor(name, parameters = []) {
    this.id = _nextId++;
    this.name = name;
    this.parameters = parameters;
    // for inspect:
    this.precedence = 1;
    // typeHandlers: { guard, type }
    this.typeHandlers = [];
    this.symbolHandlers = {};
    // override to refuse handler lookups:
    this.canCall = true;
    // am *i* a wildcard? only ParameterType says yes. :)
    this.wildcard = false;
    // are there any wildcards in my handlers? (in other words, not fully defined)
    this.wildcards = [];
  }

  inspect(seen = {}, precedence = 100) {
    if (this.name != null) {
      return this.name + (this.parameters.length == 0 ? "" : `(${this.parameters.join(", ")})`);
    }
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
   * can type 'other' be used in a place expecting this type?
   *   - if we're exactly the same type, yes.
   *   - if either side is a wildcard, yes.
   *   - otherwise, check handler signatures or something more complicated
   *       (for compound types)
   */
  canAssignFrom(other, logger, cache = [], wildcardMap = {}) {
    if (this.isType(other)) return true;
    for (let i = 0; i < cache.length; i++) {
      if (this.isType(cache[i][0]) && other.isType(cache[i][1])) return true;
    }

    if (this.wildcard) {
      // i'm a wildcard! i can coerce anything! tag, you're it!
      if (logger) logger(`${this.inspect()} := ${other.inspect()} : wildcard resolved`);
      wildcardMap[this.name] = other;
      return true;
    }
    // if (other.wildcard) {
    //   // you're a wildcard! i squish your head!
    //   wildcardMap[other.name] = this;
    //   return true;
    // }

    // avoid recursing forever:
    cache.push([ this, other ]);

    return this._canAssignFrom(other, logger, cache, wildcardMap);
  }

  /*
   * does every handler have a matching handler in the other type?
   *   - cache: [ [ left, right ] ] matches already made or in progress
   *       (to avoid infinite recursion)
   *   - wildcardMap: { name -> type } if the assignment can succeed by
   *       filling in some (`$A`) wildcard types
   */
  _canAssignFrom(other, logger, cache, wildcardMap) {
    if (logger) logger(`${this.inspect()} := ${other.inspect()} : handler scan`);
    for (const symbol in this.symbolHandlers) {
      const otherType = other.symbolHandlers.hasOwnProperty(symbol) ? other.symbolHandlers[symbol] : null;
      if (otherType == null || !this.symbolHandlers[symbol].canAssignFrom(otherType, logger, cache, wildcardMap)) {
        return false;
      }
    }

    for (let i = 0; i < this.typeHandlers.length; i++) {
      const matches = other.typeHandlers.filter(h => {
        // arg coercion is contravariant, so it has to be compared in the opposite direction.
        return h.guard.canAssignFrom(this.typeHandlers[i].guard, logger, cache, wildcardMap) &&
          this.typeHandlers[i].type.canAssignFrom(h.type, logger, cache, wildcardMap);
      });
      if (matches.length < 1) return false;
    }

    return true;
  }

  handlerTypeForSymbol(name) {
    if (this.symbolHandlers.hasOwnProperty(name)) return this.symbolHandlers[name];
    return null;
  }

  handlerTypeForMessage(inType, logger) {
    const wildcardMap = {};
    const matches = this.typeHandlers.filter(({ guard }) => guard.canAssignFrom(inType, logger, [], wildcardMap));
    if (matches.length == 0) return {};
    const guard = matches[0].guard.withWildcardMap(wildcardMap, logger);
    const type = matches[0].type.withWildcardMap(wildcardMap, logger);
    return { coerceType: guard, type };
  }

  // fill in any wildcard types from the map
  withWildcardMap(wildcardMap, logger) {
    if (this.wildcards.length == 0) return this;

    const parameters = this.parameters.map(p => {
      if (wildcardMap.hasOwnProperty(p)) return wildcardMap[p].inspect();
      return p;
    });
    const rtype = new TypeDescriptor(this.name, parameters);

    for (const symbol in this.symbolHandlers) {
      rtype.symbolHandlers[symbol] = this.symbolHandlers[symbol].withWildcardMap(wildcardMap, logger);
    }
    rtype.typeHandlers = this.typeHandlers.map(({ guard, type }) => {
      return { guard: guard.withWildcardMap(wildcardMap, logger), type: type.withWildcardMap(wildcardMap, logger) };
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

  _canAssignFrom(other, logger, cache, wildcardMap) {
    if (this.isType(other)) return true;
    if (other.nothing) {
      other = new CompoundType([]);
    } else if (!(other instanceof CompoundType)) {
      other = new CompoundType([ new CTypedField("?0", other) ]);
    }
    if (this.looselyMatches(other.fields, logger, cache, wildcardMap)) return true;
    // special case: if we're a one-field struct that is itself a struct, we have to go deeper.
    if (this.fields.length == 1 && (this.fields[0].type instanceof CompoundType)) {
      if (this.fields[0].type.looselyMatches(other.fields, logger, cache, wildcardMap)) return true;
    }
    return false;
  }

  /*
   * check for loose matching:
   *   - no extra fields
   *   - positional fields have the right type
   *   - all missing fields have default values
   */
  looselyMatches(fields, logger, cache, wildcardMap) {
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
      if (!remaining[name].type.canAssignFrom(f.type, logger, cache, wildcardMap)) return false;
      delete remaining[name];
    }
    for (const name in remaining) if (remaining[name].defaultValue == null) return false;
    return true;
  }

  withWildcardMap(wildcardMap, logger) {
    if (this.wildcards.length == 0) return this;
    const fields = this.fields.map(f => {
      return new CTypedField(f.name, f.type.withWildcardMap(wildcardMap, logger), f.defaultValue);
    });
    return new CompoundType(fields);
  }
}


export class ParameterType extends TypeDescriptor {
  constructor(name) {
    super(name);
    this.canCall = false;
    this.wildcard = true;
  }

  withWildcardMap(wildcardMap, _logger) {
    if (wildcardMap.hasOwnProperty(this.name)) return wildcardMap[this.name];
    return this;
  }
}


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

  withWildcardMap(wildcardMap, logger) {
    return mergeTypes(this.types.map(t => t.withWildcardMap(wildcardMap, logger)), logger);
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

      if (list[i].canAssignFrom(list[j], logger)) {
        if (logger) logger(`${list[i].inspect()} can assign from ${list[j].inspect()}`);
        list[j] = null;
      } else if (list[j].canAssignFrom(list[i], logger)) {
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

export function newType(name, parameters) {
  return new TypeDescriptor(name, parameters);
}

// special type for tracking 'return' in blocks:
export const NoType = newType("(none)");
