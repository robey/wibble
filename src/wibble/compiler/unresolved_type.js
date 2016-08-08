"use strict";

import { dumpExpr } from "../dump";
import { TypeDescriptor } from "./type_descriptor";

/*
 * placeholder for types we need to resolve. can't assign from anything but
 * itself. keeps a reference to the expression that isn't resolved yet, so
 * we can shake them out later.
 */
export default class UnresolvedType extends TypeDescriptor {
  /*
   * expr: AST of the unresolved expression
   * scope: (lexical) scope in effect for the expression
   * typeScope: (lexical) scope of type names in effect for the expression
   */
  constructor(expr, scope, typeScope) {
    super();
    this.expr = expr;
    this.scope = scope;
    this.typeScope = typeScope;
    // where we'll put the real type when we figure it out:
    this.type = null;
    // what free variables (other unresolved types) does this one depend on?
    this._variables = [];
    // was there an annotated type we can use to break recursion?
    this.annotatedType = null;
  }

  /*
   * optional user-supplied (already compiled) type to check later.
   */
  setAnnotation(annotatedType) {
    this.annotatedType = annotatedType;
    this.expr.coerceType = annotatedType;
  }

  _inspect(seen) {
    if (this.type) return `[resolved ${this.id}: ${this.type.inspect(seen, 9)}]`;
    const atype = this.annotatedType ? `[annotated as: ${this.annotatedType.inspect(seen, 9)}] ` : "";
    const variables = this.variables;
    const dependencies = variables.length == 0 ? "none" : variables.map(t => t.id).join(", ");
    const scopeDump = `scope=${this.scope.inspect()} typeScope=${this.typeScope.inspect()}`;
    return `[unresolved ${this.id} -> depends on ${dependencies}: ${atype}${dumpExpr(this.expr)} / ${scopeDump}]`;
  }

  // return the list of variables (types we depend on) that aren't resolved yet.
  get variables() {
    return this._variables.filter(t => t.type == null);
  }

  // fill in the computed type! a happy day!
  resolve(type) {
    this.type = type;
    this.expr.computedType = type;
  }

  reset() {
    this.type = null;
    this.expr.computedType = null;
  }

  get resolved() {
    return this.annotatedType || this.type;
  }

  addVariable(type) {
    this._variables.push(type);
  }
}
