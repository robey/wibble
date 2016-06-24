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
}


export function mergeTypes(types, logger) {
  // flatten list of types.
  const list = [].concat.apply([], types.map(type => {
    return (type.constructor.name == "MergedType") ? type.types : [ type ];
  })).filter(t => !t.isType(TNoType));

  // perform N**2 unification: reduce to the minimum set of types.
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (!list[i] || !list[j]) continue;
      if (list[i].isType(list[j])) {
        list[j] = null;
        continue;
      }
      // FIXME ParameterType
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
export const TNoType = newType("(none)");
