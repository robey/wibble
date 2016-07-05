"use strict";

import Enum from "../common/enum";
import { dumpExpr } from "../dump";

const ARROW_RIGHT = "\u2192";

let _nextId = 1;

export const Type = new Enum([ "SIMPLE", "COMPOUND", "SUM", "WILDCARD" ]);

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

/*
 * Set of handlers that map a symbol or compound type to a return type.
 */
export class TypeDescriptor {
  /*
   * name: optional (user-defined types have one)
   * parameters: any type parameters, either wildcards or concrete types
   */
  constructor(kind, name, parameters) {
    this.kind = kind;
    this.id = _nextId++;
    this.name = name;
    this.parameters = [];

    // for inspect:
    this.precedence = 1;
    // typeHandlers: { guard, type }
    this.typeHandlers = [];
    this.symbolHandlers = {};

    switch (kind) {
      case Type.SIMPLE: {
        this.parameters = parameters || [];
        break;
      }
      case Type.COMPOUND: {
        // fields: CTypedField[]
        this.fields = parameters;
        this.fields.forEach(f => this.addSymbolHandler(f.name, f.type));
        break;
      }
      case Type.SUM: {
        // sum type has components:
        this.types = parameters;
        break;
      }
    }
  }

  inspect(seen = {}, precedence = 100) {
    if (this.name != null) {
      return this.name + (this.parameters.length == 0 ? "" : `(${this.parameters.map(w => w.inspect()).join(", ")})`);
    }
    if (seen[this.id]) return "@";
    seen[this.id] = true;
    const rv = this._inspect(seen, precedence);
    seen[this.id] = false;
    return rv;
  }

  _inspect(seen, precedence) {
    switch (this.kind) {
      case Type.SIMPLE: {
        // default implementation: describe interface.
        const symbols = Object.keys(this.symbolHandlers).map(key => {
          return `.${key} -> ${this.symbolHandlers[key].inspect(seen, 2)}`;
        });
        const types = this.typeHandlers.map(({ guard, type }) => {
          return `${guard.inspect(seen, 9)} -> ${type.inspect(seen, 2)}`;
        });

        // hack to make functions print out with nicer style.
        const isFunction = symbols.length == 0 && types.length == 1;
        const myPrecedence = isFunction ? this.precedence + 1 : this.precedence;

        const description = isFunction ? types[0] : ("{ " + symbols.concat(types).join(", ") + " }");
        return myPrecedence > precedence ? "(" + description + ")" : description;
      }

      case Type.COMPOUND: {
        return "(" + this.fields.map(f => f.inspect(seen, 9)).join(", ") + ")";
      }

      case Type.SUM: {
        const rv = this.types.map(t => t.inspect(seen, this.precedence)).join(" | ");
        return this.precedence > precedence ? "(" + rv + ")" : rv;
      }
    }
  }

  addSymbolHandler(name, type) {
    this.symbolHandlers[name] = type;
  }

  addTypeHandler(guard, type) {
    this.typeHandlers.push({ guard, type });
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

  // /*
  //  * can type 'other' be used in a place expecting this type?
  //  *   - if we're exactly the same type, yes.
  //  *   - if either side is a wildcard, yes.
  //  *   - otherwise, check handler signatures or something more complicated
  //  *       (for compound types)
  //  */
  // canAssignFrom(other, logger, cache = [], wildcardMap = {}) {
  //   if (this.isType(other)) return true;
  //   for (let i = 0; i < cache.length; i++) {
  //     if (this.isType(cache[i][0]) && other.isType(cache[i][1])) return true;
  //   }
  //
  //   if (this.wildcard) {
  //     // i'm a wildcard! i can coerce anything! tag, you're it!
  //     if (logger) logger(`canAssign? ${this.inspect()} := ${other.inspect()} : wildcard resolved`);
  //     wildcardMap[this.id] = other;
  //     return true;
  //   }
  //
  //   // avoid recursing forever:
  //   cache.push([ this, other ]);
  //
  //   const mappings = Object.keys(wildcardMap).length;
  //   const rv = this._canAssignFrom(other, logger, cache, wildcardMap);
  //   if (!rv && mappings < Object.keys(wildcardMap).length) {
  //     // didn't match, but we bound at least one wildcard type. try doing a wildcard substitution?
  //     const newThis = this.withWildcardMap(wildcardMap);
  //     const newOther = other.withWildcardMap(wildcardMap);
  //     if (logger) {
  //       const mapNames = Object.keys(wildcardMap).map(id => `${id} = ${wildcardMap[id].inspect()}`);
  //       logger(`canAssign? retrying with wildcard mapping: ${mapNames.join(", ")}`);
  //     }
  //     return newThis.canAssignFrom(newOther, logger, cache, wildcardMap);
  //   } else {
  //     return rv;
  //   }
  // }

  handlerTypeForSymbol(name) {
    if (this.symbolHandlers.hasOwnProperty(name)) return this.symbolHandlers[name];
    return null;
  }

  // exact match only
  handlerTypeForMessage(type) {
    const matches = this.typeHandlers.filter(({ guard }) => guard.isType(type));
    return matches.length == 0 ? null : matches[0].type;
  }

  /*
   * scan the defined guards, looking for one that 'type' can assign into
   */
  // findMatchingGuard(type, assignmentChecker) {
  //   const matches = this.typeHandlers.filter(({ guard }) => assignmentChecker.canAssignFrom(guard, type));
  // }


  // handlerTypeForMessage(inType, logger, wildcardMap = {}) {
  //   const matches = this.typeHandlers.filter(({ guard }) => guard.canAssignFrom(inType, logger, [], wildcardMap));
  //   if (matches.length == 0) return {};
  //   const guard = matches[0].guard.withWildcardMap(wildcardMap);
  //   const type = matches[0].type.withWildcardMap(wildcardMap);
  //   return { coerceType: guard, type };
  // }

  // fill in any wildcard types from the map
  withWildcardMap(wildcardMap, logger) {
    switch (this.kind) {
      case Type.SIMPLE: {
        // bail early if there are no wildcards.
        if (this.parameters.length == 0) return this;
        if (! this.parameters.map(p => p.kind == Type.WILDCARD).reduce((a, b) => a || b)) return this;

        const parameters = this.parameters.map(p => p.withWildcardMap(wildcardMap, logger));
        const rtype = new TypeDescriptor(this.kind, this.name, parameters);

        for (const symbol in this.symbolHandlers) {
          rtype.symbolHandlers[symbol] = this.symbolHandlers[symbol].withWildcardMap(wildcardMap, logger);
        }
        rtype.typeHandlers = this.typeHandlers.map(({ guard, type }) => {
          return {
            guard: guard.withWildcardMap(wildcardMap, logger),
            type: type.withWildcardMap(wildcardMap, logger)
          };
        });

        return rtype;
      }

      case Type.COMPOUND: {
        const fields = this.fields.map(f => {
          return new CTypedField(f.name, f.type.withWildcardMap(wildcardMap, logger), f.defaultValue);
        });
        return newCompoundType(fields);
      }

      case Type.SUM: {
        return mergeTypes(this.types.map(t => t.withWildcardMap(wildcardMap, logger)), logger);
      }

      case Type.WILDCARD: {
        if (wildcardMap.hasOwnProperty(this.id)) return wildcardMap[this.id];
        return this;
      }
    }
  }
}







// -----









export class ParameterType extends TypeDescriptor {
  constructor(name) {
    super(name);
    this.canCall = false;
    this.wildcard = true;
  }
}


export class MergedType extends TypeDescriptor {
  constructor(types) {
    super();
    this.precedence = 3;
    this.types = types;
    this.canCall = false;
  }


}





export function newCompoundType(fields) {
  return new TypeDescriptor(Type.COMPOUND, null, fields);
}

export function newWildcard(name) {
  return new TypeDescriptor(Type.WILDCARD, name);
}

export function mergeTypes(types, assignmentChecker) {
  // flatten list of types.
  const list = [].concat.apply([], types.map(type => {
    return (type.kind == Type.SUM) ? type.types : [ type ];
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

      // can't merge wildcard types unless they're the same type id
      if (list[i].kind == Type.WILDCARD || list[j].kind == Type.WILDCARD) continue;

      if (assignmentChecker.canAssignFrom(list[i], list[j])) {
        if (assignmentChecker.logger) {
          assignmentChecker.logger(`merge types: ${list[i].inspect()} <- ${list[j].inspect()}`);
        }
        list[j] = null;
      } else if (assignmentChecker.canAssignFrom(list[j], list[i])) {
        if (assignmentChecker.logger) {
          assignmentChecker.logger(`merge types: ${list[j].inspect()} <- ${list[i].inspect()}`);
        }
        list[i] = null;
      }
    }
  }

  const uniques = list.filter(t => t != null);
  const rv = uniques.length == 1 ? uniques[0] : new TypeDescriptor(Type.SUM, null, uniques);
  if (assignmentChecker.logger) assignmentChecker.logger(`merge types: ${types.map(t => t.inspect()).join(" | ")} ${ARROW_RIGHT} ${rv.inspect()}`);
  return rv;
}

export function newType(name, parameters) {
  const wildcards = (parameters || []).map(newWildcard);
  return new TypeDescriptor(Type.SIMPLE, name, wildcards);
}

// special type for tracking 'return' in blocks:
export const NoType = newType("(none)");
