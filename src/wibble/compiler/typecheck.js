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
import { newType } from "./type_descriptor";
import UnresolvedType from "./unresolved_type";

export class CReference {
  constructor(name, type, mutable) {
    this.name = name;
    this.type = type;
    this.mutable = mutable;
  }
}

/*
 * state to track when memoizing future work for a particular node on the
 * AST:
 *   - scope: current lexical scope for symbols
 *   - typeScope: may have '@' added when inside a 'new'
 *   - type: any type currently being defined
 *   - unresolvedType: if we're walking through the expression for a type
 *       that needs to be resolved
 */
class TreeState {
  constructor(scope, typeScope, type, unresolvedType) {
    this.scope = scope;
    this.typeScope = typeScope;
    this.type = type;
    this.unresolvedType = unresolvedType;
  }

  save() {
    return new TreeState(this.scope, this.typeScope, this.type, this.unresolvedType);
  }

  restore(other) {
    this.scope = other.scope;
    this.typeScope = other.typeScope;
    this.type = other.type;
    this.unresolvedType = other.unresolvedType;
  }

  inspect() {
    return "TreeState(" + [
      this.scope.inspect(),
      this.typeScope.inspect(),
      this.type ? this.type.inspect() : "null",
      this.unresolvedType ? this.unresolvedType.inspect() : "null"
    ].join(", ") + ")";
  }
}

export class TypeChecker {
  /*
   * - errors: Errors object to collect new errors
   * - typeScope: used to find base types like "Int", and to resolve type
   *     annotations in the expression (name -> TypeDescriptor)
   * - logger: function to call to log details about the logic
   */
  constructor(errors, typeScope, logger) {
    this.errors = errors;
    this.typeScope = typeScope;
    this.logger = logger;
  }

  /*
   * - expr: AST to typecheck
   * - scope: used to find types of symbols in the current lexical scope
   *     (name -> CReference)
   */
  typecheck(expr, scope) {
    if (this.logger) this.logger(`typecheck: ${dumpExpr(expr)}`);
    const unresolved = this.buildScopes(expr, scope);

    // -----
    const wildcardMap = {};

    // keep trying as long as we find new wildcard matches.
    // stop if we succeed, or stop making progress.
    let mappings, type;
    this.errors.mark();
    do {
      if (this.logger) this.logger(`typecheck: entering progress loop for ${dumpExpr(expr)}`);
      mappings = Object.keys(wildcardMap).length;
      this.errors.restore();
      unresolved.forEach(t => t.reset());
      resolveTypes(expr, unresolved, this.errors, this.logger, wildcardMap);
      type = computeType(expr, this.errors, scope, this.typeScope, this.logger, wildcardMap);
    } while (this.errors.haveIncreased() && Object.keys(wildcardMap).length > mappings);
    if (this.logger) this.logger(`typecheck: ${dumpExpr(expr)} : ${type.inspect()}`);
    return type;
  }

  /*
   * 1. Attach a new (locals) scope to each block and handler.
   * 2. Attach an unknown-type reference to each local.
   * 3. Catch unresolved references and duplicate names.
   *
   * returns an array of the new UnresolvedType objects it made.
   */
  buildScopes(expr, scope) {
    const Anything = this.typeScope.get("Anything");

    // list of UnresolvedType objects we created.
    const unresolved = [];

    const visit = (node, state, handlers) => {
      // create scopes.
      if (node.nodeType == "POn" && node.children[0].nodeType == "PCompoundType") {
        // open up a new scope for the parameters.
        node.scope = state.scope = new Scope(state.scope);
        node.guardType = compileType(node.children[0], this.errors, state.typeScope, this.loggern);
        node.guardType.fields.forEach(field => {
          state.scope.add(field.name, new CReference(field.name, field.type, false));

          if (field.defaultValue != null) {
            state.unresolvedType = new UnresolvedType(field.defaultValue, state.scope, state.typeScope);
            // trust the type annotation for now. (we'll check later.)
            state.unresolvedType.setAnnotation(field.type);
            unresolved.push(state.unresolvedType);
          }
        });
      }

      // do some quick checks.
      switch (node.nodeType) {
        case "PReference": {
          if (state.scope.get(node.name) == null) {
            this.errors.add(`Undefined reference '${node.name}'`, node.span);
            // stub in an "Anything" immutable so we can plug onward.
            state.scope.add(node.name, new CReference(node.name, Anything, false));
          }
          const rtype = state.scope.get(node.name).type;
          if ((rtype instanceof UnresolvedType) && state.unresolvedType) {
            state.unresolvedType.addVariable(rtype);
          }
          break;
        }

        case "PNew": {
          // attach a new (blank) type that we'll fill with handlers.
          node.newType = state.type = newType();
          if (node.children[0].nodeType == "PBlock") {
            node.scope = state.scope = new Scope(state.scope);
            // new -> block: push a new typeScope with "@" defined.
            state.scope.add("@", new CReference("@", state.type, false));
            state.typeScope = new Scope(state.typeScope);
            state.typeScope.add("@", state.type);
          }
          break;
        }

        case "PAssignment": {
          const name = node.children[0].name;
          const rtype = state.scope.get(name);
          if (rtype == null) {
            this.errors.add(`Undefined reference '${name}'`, node.children[0].span);
          } else if (!rtype.mutable) {
            this.errors.add(`Assignment to immutable (let) '${name}'`, node.children[0].span);
          }
          break;
        }

        case "PLocal": {
          if (state.scope.get(node.name) != null) {
            this.errors.add(`Redefined local '${node.name}'`, node.span);
          } else {
            /*
             * add an unresolved-type marker for now, because the expression
             * might be a handler that makes a recursive reference to itself.
             */
            state.unresolvedType = new UnresolvedType(node.children[0], state.scope, state.typeScope);
            unresolved.push(state.unresolvedType);
            state.scope.add(node.name, new CReference(node.name, state.unresolvedType, node.mutable));
          }
          break;
        }

        case "POn": {
          // punt!
          handlers.push({ node, state: state.save() });
          return;
        }

        case "PBlock": {
          node.scope = state.scope = new Scope(state.scope);
          const savedState = state.save();
          node.children.forEach(n => {
            visit(n, state, handlers);
            state.restore(savedState);
          });
          state = savedState;
          return;
        }
      }

      // now, traverse children.
      if (node.children.length > 0) {
        const savedState = state.save();
        node.children.forEach(n => {
          visit(n, state, handlers);
          state.restore(savedState);
        });
      }
    };

    // do late processing on handlers so they have access to anything defined in the scope from later in the block.
    const processHandlers = (handlers) => {
      const newHandlers = [];

      handlers.forEach(({ node, state }) => {
        // mark return type as unresolved. we'll figure it out when we shake the bucket later.
        const rtype = new UnresolvedType(node.children[1], state.scope, state.typeScope);
        unresolved.push(rtype);
        if (node.children[2] != null) {
          // trust the type annotation for now. (we'll check later.)
          const annotatedType = compileType(node.children[2], this.errors, state.typeScope, this.logger);
          rtype.setAnnotation(annotatedType);
        } else {
          if (state.unresolvedType) state.unresolvedType.addVariable(rtype);
        }
        state.unresolvedType = rtype;
        if (node.guardType != null) {
          state.type.addTypeHandler(node.guardType, rtype);
        } else {
          state.type.addSymbolHandler(node.children[0].value, rtype);
        }

        // now, traverse children.
        if (node.children.length > 0) {
          const savedState = state.save();
          node.children.forEach(n => {
            visit(n, state, newHandlers);
            state.restore(savedState);
          });
        }
      });

      return newHandlers;
    };

    let handlers = [];
    const state = new TreeState(scope, this.typeScope, null, null);
    visit(expr, state, handlers);
    // process any 'on' handlers we delayed. they might, themselves, find more 'on' handlers, too.
    do {
      handlers = processHandlers(handlers);
    } while (handlers.length > 0);
    return unresolved;
  }
}








/*
 * 4. assume the unresolved types and their dependencies (free variables)
 *    make a kind of DAG, and shake the bucket to keep resolving any that
 *    have no more free variables.
 * 5. walk the tree again and replace unresolved type markers with their
 *    solutions. mark any mismatched types (declared vs inferred) as errors.
 */
function resolveTypes(expr, unresolved, errors, logger, wildcardMap) {
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

    if (node.coerceType && node.computedType && !node.coerceType.canAssignFrom(node.computedType, logger, [], wildcardMap)) {
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
