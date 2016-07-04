"use strict";

import { CTypedField, newCompoundType, Type } from "./type_descriptor";

/*
 * logic for deciding if type A can be assigned from type B.
 */
export class AssignmentChecker {
  constructor(errors, logger) {
    this.errors = errors;
    this.logger = logger;
    // "id:id" => true/false
    this.cache = {};
    // track wildcard resolutions (id -> type)
    this.wildcardMap = {};
  }

  canAssignFrom(type1, type2) {
    if (this.logger) this.logger(`canAssign? ${type1.inspect()} := ${type2.inspect()}`);
    const rv = this._canAssignFrom(type1, type2);
    if (this.logger) this.logger(`canAssign? ${type1.inspect()} := ${type2.inspect()}  ${rv ? "YES" : "NO"}`);
    return rv;
  }

  _canAssignFrom(type1, type2) {
    // if left type is Nothing, fail.
    if (type1.nothing) return false;
    // if right type is Nothing, and left type isn't a compound type, fail.
    if (type2.nothing && type1.kind != Type.COMPOUND) return false;

    // if the types are identical, or we have a previously-cached result, we're done.
    if (type1.isType(type2)) return true;
    const cacheKey = `${type1.id}:${type2.id}`;
    if (this.cache.hasOwnProperty(cacheKey)) return this.cache[cacheKey];

    if (type1.kind == Type.WILDCARD) {
      // i'm a wildcard! i can coerce anything! tag, you're it!
      if (this.logger) this.logger(`canAssign? ${type1.inspect()} := ${type2.inspect()}  wildcard resolved`);
      this.wildcardMap[type1.id] = type2;
      return true;
    }

    // FIXME: cache to avoid loops?

    switch (type1.kind) {
      case Type.SIMPLE: {
        return this.handlersMatch(type1, type2);
      }

      case Type.COMPOUND: {
        if (type2.nothing) {
          type2 = newCompoundType([]);
        } else if (type2.kind != Type.COMPOUND) {
          type2 = newCompoundType([ new CTypedField("?0", type2) ]);
        }
        if (this.fieldsMatch(type1.fields, type2.fields)) return true;
        // special case: if we're a one-field struct that is itself a struct, we have to go deeper.
        if (type1.fields.length == 1 && type1.fields[0].type.kind == Type.COMPOUND) {
          if (this.fieldsMatch(type1.fields[0].type.fields, type2.fields)) return true;
        }
        return false;
      }
    }
    // sum: check alts?

    return false;
  }

  /*
   * does every handler in type1 have a matching handler in type2?
   */
  handlersMatch(type1, type2) {
    if (this.logger) this.logger(`canAssign? ${type1.inspect()} := ${type2.inspect()}  handler scan`);

    for (const symbol in type1.symbolHandlers) {
      const otherType = type2.symbolHandlers.hasOwnProperty(symbol) ? type2.symbolHandlers[symbol] : null;
      if (otherType == null || !this.canAssignFrom(type1.symbolHandlers[symbol], otherType)) {
        return false;
      }
    }

    for (let i = 0; i < type1.typeHandlers.length; i++) {
      const { guard, type } = type1.typeHandlers[i];
      const matches = type2.typeHandlers.filter(h => {
        // arg coercion is contravariant, so it has to be compared in the opposite direction.
        return this.canAssignFrom(h.guard, guard) && this.canAssignFrom(type, h.type);
      });
      if (matches.length < 1) return false;
    }

    return true;
  }

  /*
   * check for loose matching fields:
   *   - no extra fields
   *   - positional fields have the right type
   *   - all missing fields have default values
   */
  fieldsMatch(fields1, fields2) {
    const remaining = {};
    fields1.forEach(f => {
      remaining[f.name] = f;
    });

    for (let i = 0; i < fields2.length; i++) {
      const f = fields2[i];
      let name = f.name;
      if (name[0] == "?") {
        // positional.
        if (i >= fields1.length) return false;
        name = fields1[i].name;
      }
      if (remaining[name] == null) return false;
      if (!this.canAssignFrom(remaining[name].type, f.type)) return false;
      delete remaining[name];
    }

    for (const name in remaining) if (remaining[name].defaultValue == null) return false;
    return true;
  }
}
