"use strict";

/*
 * FIXME: TODO:
 *
 *   - check that the declared type of a 'new' matches the created type
 */

import { computeType } from "./compute_type";
import { compileType } from "./c_type";
import { dumpExpr } from "../dump";
import { Scope } from "./scope";
import { newType, TypeDescriptor } from "./type_descriptor";

export class CReference {
  constructor(name, type, mutable) {
    this.name = name;
    this.type = type;
    this.mutable = mutable;
  }
}

/*
 * placeholder for types we need to resolve. can't assign from anything but
 * itself. keeps a reference to the expression that isn't resolved yet, so
 * we can shake them out later.
 */
class UnresolvedType extends TypeDescriptor {
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
    return `[unresolved ${this.id} -> depends on ${dependencies}: ${atype}${dumpExpr(this.expr)}]`;
  }

  canAssignFrom(other) {
    return this.isType(other);
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

  get resolved() {
    return this.annotatedType || this.type;
  }

  addVariable(type) {
    this._variables.push(type);
  }
}


/*
 * 1. Attach a new (locals) scope to each block and handler.
 * 2. Attach an unknown-type reference to each local.
 * 3. Catch unresolved references and duplicate names.
 *
 * - scope: name -> CReference
 *
 * returns an array of the new UnresolvedType it made.
 */
function buildScopes(expr, errors, scope, typeScope, logger) {
  // what type is currently being defined?
  let type = null;

  // what UnresolvedType are we investigating and collecting variables for?
  let unresolvedType = null;

  // collect unprocessed "on" expressions to run at the end of the block.
  let handlers = [];

  // stack of the "current" scope, typeScope, type, unresolvedType, and handlers.
  const stack = [];

  // list of UnresolvedType objects we created.
  const unresolved = [];

  visit(expr);
  handlers.forEach(data => {
    save();
    restoreTo(data.state);
    visit(data.node, { handlers: true });
    restore();
  });
  return unresolved;

  function save() {
    stack.push(saveState());
  }

  function saveState() {
    return { scope, typeScope, type, unresolvedType, handlers };
  }

  function restore() {
    // babel can't handle this kind of deconstruction.
    restoreTo(stack.pop());
  }

  function restoreTo(state) {
    scope = state.scope;
    typeScope = state.typeScope;
    type = state.type;
    unresolvedType = state.unresolvedType;
    handlers = state.handlers;
  }

  function visit(node, options = {}) {
    // create scopes.
    if (node.nodeType == "POn" && node.children[0].nodeType == "PCompoundType") {
      // open up a new scope for the parameters.
      node.scope = scope = new Scope(scope);
      node.children[0].children.forEach(field => {
        const ftype = compileType(field.type, errors, typeScope, logger);
        scope.add(field.name, new CReference(field.name, ftype, false));

        if (field.defaultValue != null) {
          unresolvedType = new UnresolvedType(field.defaultValue, scope, typeScope);
          // trust the type annotation for now. (we'll check later.)
          unresolvedType.setAnnotation(ftype);
          unresolved.push(unresolvedType);
        }
      });
    }

    // do some quick checks.
    switch (node.nodeType) {
      case "PReference": {
        if (scope.get(node.name) == null) {
          errors.add(`Undefined reference '${node.name}'`, node.span);
          // stub in an "Anything" immutable so we can plug onward.
          scope.add(node.name, new CReference(node.name, typeScope.get("Anything"), false));
        }
        const rtype = scope.get(node.name).type;
        if ((rtype instanceof UnresolvedType) && unresolvedType) unresolvedType.addVariable(rtype);
        break;
      }

      case "PNew": {
        // attach a new (blank) type that we'll fill with handlers.
        node.newType = type = newType();
        if (node.children[0].nodeType == "PBlock") {
          node.scope = scope = new Scope(scope);
          // new -> block: push a new typeScope with "@" defined.
          scope.add("@", new CReference("@", type, false));
          typeScope = new Scope(typeScope);
          typeScope.add("@", type);
        }
        break;
      }

      case "PAssignment": {
        const name = node.children[0].name;
        const rtype = scope.get(name);
        if (rtype == null) {
          errors.add(`Undefined reference '${name}'`, node.children[0].span);
        } else if (!rtype.mutable) {
          errors.add(`Assignment to immutable (let) '${name}'`, node.children[0].span);
        }
        break;
      }

      case "PLocal": {
        if (scope.get(node.name) != null) {
          errors.add(`Redefined local '${node.name}'`, node.span);
        } else {
          /*
           * add an unresolved-type marker for now, because the expression
           * might be a handler that makes a recursive reference to itself.
           */
          unresolvedType = new UnresolvedType(node.children[0], scope, typeScope);
          unresolved.push(unresolvedType);
          scope.add(node.name, new CReference(node.name, unresolvedType, node.mutable));
        }
        break;
      }

      case "POn": {
        if (!options.handlers) {
          // punt!
          handlers.push({ node, state: saveState() });
          return;
        } else {
          // mark return type as unresolved. we'll figure it out when we shake the bucket later.
          const rtype = new UnresolvedType(node.children[1], scope, typeScope);
          unresolved.push(rtype);
          if (node.children[2] != null) {
            // trust the type annotation for now. (we'll check later.)
            const annotatedType = compileType(node.children[2], errors, typeScope, logger);
            rtype.setAnnotation(annotatedType);
          } else {
            if (unresolvedType) unresolvedType.addVariable(rtype);
          }
          unresolvedType = rtype;
          if (node.children[0].nodeType == "PCompoundType") {
            const guardType = compileType(node.children[0], errors, typeScope, logger);
            type.addTypeHandler(guardType, rtype);
          } else {
            type.addSymbolHandler(node.children[0].value, rtype);
          }
        }
        break;
      }

      case "PBlock": {
        node.scope = scope = new Scope(scope);
        handlers = [];
        break;
      }
    }

    // now, traverse children.
    if (node.children.length > 0) {
      save();
      node.children.forEach(n => visit(n, options));
      restore();
    }

    // now process any handlers we saw in the block, so they have access to all the locals.
    if (node.nodeType == "PBlock") {
      handlers.forEach(data => {
        save();
        restoreTo(data.state);
        visit(data.node, { handlers: true });
        restore();
      });
      handlers = [];
    }
  }
}

/*
 * 4. assume the unresolved types and their dependencies (free variables)
 *    make a kind of DAG, and shake the bucket to keep resolving any that
 *    have no more free variables.
 * 5. walk the tree again and replace unresolved type markers with their
 *    solutions. mark any mismatched types (declared vs inferred) as errors.
 */
function resolveTypes(expr, unresolved, errors, logger) {
  let stillUnresolved = tryProgress(unresolved);
  while (stillUnresolved.length > 0 && stillUnresolved.length < unresolved.length) {
    unresolved = stillUnresolved;
    stillUnresolved = tryProgress(unresolved);
  }
  if (stillUnresolved.length > 0) {
    // couldn't solve it. :(
    stillUnresolved.forEach(ut => {
      errors.add("Recursive definition needs explicit type declaration", ut.expr.span);
      ut.type = ut.typeScope.get("Anything");
      ut.expr.computedType = ut.type;
    });
  }

  // now, walk the expr, looking for new scopes & type definitions, replacing
  // the unresolved type markers with their solutions.
  fixup(expr);

  function fixup(node) {
    if (node.scope) node.scope.forEach(name => {
      const cref = node.scope.get(name);
      cref.type = cref.type.resolved;
    });
    if (node.newType) {
      Object.keys(node.newType.symbolHandlers).forEach(symbol => {
        node.newType.symbolHandlers[symbol] = node.newType.symbolHandlers[symbol].resolved;
      });
      node.newType.typeHandlers = node.newType.typeHandlers.map(({ guard, type }) => {
        return { guard, type: type.resolved };
      });
    }

    if (node.coerceType && node.computedType && !node.coerceType.canAssignFrom(node.computedType, logger)) {
      errors.add(
        `Expected type ${node.coerceType.inspect()}; inferred type ${node.computedType.inspect()}`,
        node.span
      );
    }

    node.children.forEach(fixup);
  }

  /*
   * optimistically assume that the unresolved types make a DAG, and resolve
   * anything we can find that has zero radicals.
   */
  function tryProgress(unresolved) {
    if (logger) {
      logger("try to resolve:");
      unresolved.forEach(ut => logger("  " + ut.inspect()));
    }

    return unresolved.filter(ut => {
      if (ut.variables.length > 0) return true;

      // can resolve this one!
      if (logger) logger(`attempting to resolve: ${ut.inspect()}`);
      ut.resolve(computeType(ut.expr, errors, ut.scope, ut.typeScope, logger));
      if (logger) logger(`resolved type: ${ut.inspect()}`);
      return false;
    });
  }
}


export function typecheck(expr, errors, scope, typeScope, logger) {
  if (logger) logger(`typecheck: ${dumpExpr(expr)}`);
  const unresolved = buildScopes(expr, errors, scope, typeScope, logger);
  resolveTypes(expr, unresolved, errors, logger);
  return computeType(expr, errors, scope, typeScope, logger);
}
