"use strict";

/*
 * FIXME: TODO:
 *
 *   - check that the declared type of a 'new' matches the created type
 */

import { AssignmentChecker } from "./assign";
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
      "scope=" + this.scope.inspect(),
      "typeScope=" + this.typeScope.inspect(),
      "type=" + (this.type ? this.type.inspect() : "null"),
      "unresolved=" + (this.unresolvedType ? this.unresolvedType.inspect() : "null")
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
    this.assignmentChecker = new AssignmentChecker(this.errors, this.logger, typeScope);
    // do some fancy tree-based logging.
    this.logger = logger;
    this.logPrefix = [];
    this.logState = [];
  }

  logNestIn(childCount) {
    if (this.logState.length > 0) {
      this.logState[0].prefix = this.logState[0].visited == this.logState[0].total ? "  " : "| ";
    }
    this.logState.unshift({ lines: 0, visited: 0, total: childCount, prefix: childCount == 1 ? "`-" : "|-" });
  }

  logNestNext(newChildCount) {
    if (newChildCount != null) this.logState[0].total = newChildCount;
    this.logState[0].visited++;
    this.logState[0].prefix = this.logState[0].visited == this.logState[0].total ? "`-" : "|-";
    this.logState[0].lines = 0;
  }

  logNestOut() {
    this.logState.shift();
  }

  log(text) {
    const prefix = this.logState.map(s => s.prefix).reverse().join("");
    text.split("\n").forEach(line => {
      this.logger(prefix + line);
    });
    if (this.logState.length > 0) {
      this.logState[0].lines++;
      if (this.logState[0].lines == 1) {
        this.logState[0].prefix = this.logState[0].visited == this.logState[0].total ? "  " : "| ";
      }
    }
  }

  /*
   * - expr: AST to typecheck
   * - scope: used to find types of symbols in the current lexical scope
   *     (name -> CReference)
   */
  typecheck(expr, scope) {
    if (this.logger) this.log(`typecheck: ${dumpExpr(expr)}`);

    const unresolved = this.buildScopes(expr, scope);
    this.resolveTypes(expr, unresolved);
    this.flattenResolvedTypes(expr);
    return computeType(expr, this.errors, scope, this.typeScope, this.logger, this.assignmentChecker);
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

    const visit = (node, state) => {
      if (this.logger) this.log("visit: " + dumpExpr(node));

      // create scopes.
      if (node.nodeType == "POn" && node.children[0].nodeType == "PCompoundType") {
        // open up a new scope for the parameters.
        node.scope = state.scope = new Scope(state.scope);
        node.typeScope = state.typeScope = new Scope(state.typeScope);

        node.guardType = compileType(node.children[0], this.errors, state.typeScope, this.assignmentChecker);
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
          // mark return type as unresolved. we'll figure it out when we shake the bucket later.
          const rtype = new UnresolvedType(node.children[1], state.scope, state.typeScope);
          if (this.logger) this.log(`added unresolved type here: ${rtype.inspect()}`);
          unresolved.push(rtype);
          if (node.children[2] != null) {
            // trust the type annotation for now. (we'll check later.)
            const annotatedType = compileType(
              node.children[2], this.errors, node.typeScope, this.assignmentChecker, false
            );
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

          // punt on handlers.
          if (this.logger) this.log("punt handler " + node.children[1].inspect());
          handlers.push({ node: node.children[1], state: state.save() });
          return;
        }

        case "PBlock": {
          node.scope = state.scope = new Scope(state.scope);
          if (node.parent && node.parent.nodeType == "PNew") {
            // new -> block: push a new typeScope with "@" defined.
            state.scope.add("@", new CReference("@", state.type, false));
            state.typeScope = new Scope(state.typeScope);
            state.typeScope.add("@", state.type);
          }
          break;
        }
      }

      // now, traverse children.
      if (node.children.length > 0) {
        const savedState = state.save();
        if (this.logger) {
          this.log("save state: " + savedState.inspect());
          this.logNestIn(node.children.length);
        }
        node.children.forEach(n => {
          if (this.logger) this.logNestNext();
          visit(n, state);
          state.restore(savedState);
          if (this.logger) this.log("restore state: " + savedState.inspect());
        });
        state = savedState;
        if (this.logger) {
          this.log("restore state final: " + state.inspect());
          this.logNestOut();
        }
      }

      if (node.nodeType == "PCall") {
        /*
         * is the right hand side an anonymous expression?
         */
        // const target = node.children[1];
        // if (target.nodeType == "PNew" && target.children[0].nodeType == "POn") {
        //   const guard = target.children[0];
        //   if (guard.guardType && guard.guardType.hasWildcards()) {
        //     // yes. mark it funny-looking.
        //     const ltype = new UnresolvedType(node.children[0], state.scope, state.typeScope);
        //     const rtype = new UnresolvedType(node.children[1], state.scope, state.typeScope);
        //     rtype.addVariable(ltype);
        //     if (this.logger) {
        //       this.log(`added left unresolved type here: ${ltype.inspect()}`);
        //       this.log(`added right unresolved type here: ${rtype.inspect()}`);
        //     }
        //     unresolved.push(ltype);
        //     unresolved.push(rtype);
        //   }
        //   if (this.logger) this.log("->>" + guard.guardType.inspect() + " -- " + guard.guardType.hasWildcards());
        // }
      }
    };

    const handlers = [];
    const state = new TreeState(scope, this.typeScope, null, null);
    visit(expr, state);

    /*
     * code from the right side of 'on' handlers is saved for processing
     * after everything else, since it's allowed to reference locals defined
     * later in the enclosing block. the enclosing block may also be several
     * levels out, so we do it at the very last moment, and keep trying
     * after all the other code in the block runs, so all locals will
     * be in the scope object for resolution.
     */
    if (this.logger) {
      this.log("processing punted handlers now");
      this.logNestIn(handlers.length);
    }
    while (handlers.length > 0) {
      if (this.logger) this.logNestNext(handlers.length);
      const { node, state } = handlers.shift();
      visit(node, state);
    }
    if (this.logger) {
      this.logNestOut();
      this.log("done processing punted handlers");
    }

    return unresolved;
  }

  /*
   * 4. assume the unresolved types and their dependencies (free variables)
   *    make a kind of DAG, and shake the bucket to keep resolving any that
   *    have no more free variables.
   */
  resolveTypes(expr, unresolved) {
    if (this.logger) {
      this.log("resolve types:");
      this.log(expr.inspect(true));
    }
    let stillUnresolved = this.tryProgress(unresolved);
    while (stillUnresolved.length > 0 && stillUnresolved.length < unresolved.length) {
      unresolved = stillUnresolved;
      stillUnresolved = this.tryProgress(unresolved);
    }
    if (this.logger) {
      this.log("done resolving types.");
    }
    if (stillUnresolved.length > 0) {
      // couldn't solve it. :(
      const Anything = this.typeScope.get("Anything");
      stillUnresolved.forEach(ut => {
        this.errors.add("Recursive definition needs explicit type declaration", ut.expr.span);
        ut.type = Anything;
        ut.expr.computedType = ut.type;
      });
    }
  }

  /*
   * optimistically assume that the unresolved types make a DAG, and resolve
   * anything we can find that has zero radicals.
   */
  tryProgress(unresolved) {
    if (this.logger) {
      this.log("try to resolve:");
      unresolved.forEach(ut => this.log("  " + ut.inspect()));
    }

    return unresolved.filter(ut => {
      if (ut.variables.length > 0) return true;

      // can resolve this one!
      if (this.logger) {
        this.log(`attempting to resolve: ${ut.inspect()}`);
        this.logNestIn(1);
        this.logNestNext();
      }
      const logger = this.logger ? text => this.log(text) : null;
      ut.resolve(computeType(ut.expr, this.errors, ut.scope, ut.typeScope, logger, this.assignmentChecker));
      if (this.logger) {
        this.logNestOut();
        this.log(`resolved type: ${ut.inspect()}`);
      }
      return false;
    });
  }

  /*
   * 5. walk the tree again and replace unresolved type markers with their
   *    solutions. mark any mismatched types (declared vs inferred) as errors.
   */
  flattenResolvedTypes(expr) {
    if (expr.scope) {
      // everything in a scope starts as unresolved.
      expr.scope.forEach((name, cref) => {
        cref.type = this.assignmentChecker.resolve(cref.type);
      });
    }

    if (expr.newType) {
      Object.keys(expr.newType.symbolHandlers).forEach(symbol => {
        expr.newType.symbolHandlers[symbol] = this.assignmentChecker.resolve(expr.newType.symbolHandlers[symbol]);
      });
      expr.newType.typeHandlers = expr.newType.typeHandlers.map(({ guard, type }) => {
        return { guard, type: this.assignmentChecker.resolve(type) };
      });
    }

    if (
      expr.coerceType && expr.computedType &&
      !this.assignmentChecker.canAssignFrom(expr.coerceType, expr.computedType)
    ) {
      this.errors.add(
        `Expected type ${expr.coerceType.inspect()}; inferred type ${expr.computedType.inspect()}`,
        expr.span
      );
    }

    expr.children.forEach(node => this.flattenResolvedTypes(node));
  }
}
