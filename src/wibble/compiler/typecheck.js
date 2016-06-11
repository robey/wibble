"use strict";

import { PConstantType } from "../common/ast";
import { dumpExpr } from "../dump";
import { compileType } from "./c_type";
import { Scope } from "./scope";
import { CompoundType, CTypedField, mergeTypes, newType, TypeDescriptor } from "./type_descriptor";

const APPLY_SYMBOL = "\u2053";

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
  constructor(expr, scope, typeScope) {
    super();
    this.expr = expr;
    this.scope = scope;
    this.typeScope = typeScope;
    // where we'll put the real type when we figure it out:
    this.type = null;
    // what free variables (other unresolved types) does this one depend on?
    this.variables = [];
    // was there an annotated type we can use to break recursion?
    this.annotatedType = null;
  }

  _inspect(seen) {
    if (this.type) return `[resolved ${this.id}: ${this.type.inspect(seen, 9)}]`;
    const atype = this.annotatedType ? `[annotated as: ${this.annotatedType.inspect(seen, 9)}] ` : "";
    const dependencies = this.variables.length == 0 ? "none" : this.variables.map(t => t.id).join(", ");
    return `[unresolved ${this.id} -> ${dependencies}: ${atype}${dumpExpr(this.expr)}]`;
  }

  canAssignFrom(other) {
    return this.isType(other);
  }

  resolved() {
    return this.annotatedType || this.type;
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
function buildScopes(expr, errors, scope, typeScope) {
  let type = null;
  let variables = [];

  // keep breadcrumbs of the path we took to get to this node.
  const path = [];
  // stack of the "current" scope, typeScope, any type being defined, and free variables in an unresolved expression.
  const stack = [];

  // list of UnresolvedType objects we created.
  const unresolved = [];

  navigate(expr);
  return unresolved;

  function navigate(node) {
    // create scopes.
    if (node.nodeType == "PBlock") node.scope = scope = new Scope(scope);
    if (node.nodeType == "POn" && node.children[0].constructor.name == "PCompoundType") {
      // open up a new scope for the parameters.
      node.scope = scope = new Scope(scope);
      node.children[0].children.forEach(field => {
        const ftype = compileType(field.type, errors, typeScope);
        scope.add(field.name, new CReference(field.name, ftype, false));
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
        if (rtype instanceof UnresolvedType) variables.push(rtype);
        break;
      }

      case "PNew": {
        // attach a new (blank) type that we'll fill with handlers.
        node.newType = type = newType();
        if (node.children[0].nodeType == "PBlock") {
          // new -> block: push a new scope & typeScope with "@" defined.
          node.scope = scope = new Scope(scope);
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
          const ltype = new UnresolvedType(node.children[0], scope, typeScope);
          unresolved.push(ltype);
          variables = ltype.variables;
          scope.add(node.name, new CReference(node.name, ltype, node.mutable));
        }
        break;
      }

      case "POn": {
        // mark return type as unresolved. we'll figure it out when we shake the bucket later.
        const rtype = new UnresolvedType(node.children[1], scope, typeScope);
        unresolved.push(rtype);
        variables = rtype.variables;
        if (node.children[2] != null) {
          // trust the type annotation for now. (we'll check later.)
          rtype.annotatedType = compileType(node.children[2], errors, typeScope);
        } else {
          variables.push(rtype);
        }
        if (node.children[0].nodeType == "PCompoundType") {
          const guardType = compileType(node.children[0], errors, typeScope);
          type.addTypeHandler(guardType, rtype);
        } else {
          type.addSymbolHandler(node.children[0].value, rtype);
        }
        break;
      }
    }

    // now, traverse children.
    if (node.children.length > 0) {
      path.push(node);
      stack.push({ scope, typeScope, type, variables });

      // do checks of "on" handlers last, since they're allowed to make forward references.
      node.children.filter(n => n.nodeType != "POn").forEach(navigate);
      node.children.filter(n => n.nodeType == "POn").forEach(navigate);

      path.pop();
      // babel can't handle this kind of deconstruction.
      const context = stack.pop();
      scope = context.scope;
      typeScope = context.typeScope;
      type = context.type;
      variables = context.variables;
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
      if (cref.type instanceof UnresolvedType) cref.type = cref.type.type;
    });
    if (node.newType) {
      Object.keys(node.newType.symbolHandlers).forEach(symbol => {
        const t = node.newType.symbolHandlers[symbol];
        if (t instanceof UnresolvedType) node.newType.symbolHandlers[symbol] = t.resolved();
      });
      node.newType.typeHandlers = node.newType.typeHandlers.map(({ guard, type }) => {
        if (type instanceof UnresolvedType) return { guard, type: type.resolved() };
        return { guard, type };
      });
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
      // drop any free variables that are now resolved.
      ut.variables = ut.variables.filter(t => t.type == null);
      if (ut.variables.length > 0) return true;

      // can resolve this one!
      if (logger) logger(`attempting to resolve: ${ut.inspect()}`);
      ut.type = computeType(ut.expr, errors, ut.scope, ut.typeScope, logger);
      ut.expr.computedType = ut.type;
      if (logger) logger(`resolved type: ${ut.inspect()}`);
      return false;
    });
  }
}

/*
 * 5. walk the tree, matching inferred types with declared types.
 */
// function checkTypes(expr) {
//   function walk(node) {
//     switch (node.nodeType) {
//       case "POn": {
//
//       }
//     }
//     node.children.forEach(walk);
//   }
// }

/*
 * unresolved:
 *   - alias type "@" to the nearest outer "new"
 *   - when a type is explicitly given, verify that it matches our inferred type.
 *   - recursion? (nail-biter)
 *   - verify that PCompoundType default params match their declared type
 */



/*
 * compute the type of an expression by recursively computing the types of
 * its children and combining them.
 *
 * the typeScope is required to have the built-in types (Nothing, Int, ...)
 * defined so that constants can be type-checked.
 *
 * - scope: name -> CReference
 * - typeScope: name -> TypeDescriptor
 */
export function computeType(expr, errors, scope, typeScope, logger) {
  if (logger) logger(`computeType ->: ${dumpExpr(expr)}`);
  const rv = _computeType(expr, errors, scope, typeScope, logger);
  if (logger) logger(`computeType <-: ${dumpExpr(expr)} == ${rv.inspect()}`);
  return rv;
}

function _computeType(expr, errors, scope, typeScope, logger) {
  switch (expr.nodeType) {
    case "PConstant": {
      switch (expr.type) {
        case PConstantType.NOTHING: return typeScope.get("Nothing");
        case PConstantType.BOOLEAN: return typeScope.get("Boolean");
        case PConstantType.SYMBOL: return typeScope.get("Symbol");
        case PConstantType.NUMBER_BASE10: return typeScope.get("Int");
        case PConstantType.NUMBER_BASE16: return typeScope.get("Int");
        case PConstantType.NUMBER_BASE2: return typeScope.get("Int");
        case PConstantType.STRING: return typeScope.get("String");
        default: throw new Error("Internal error: No such constant type " + expr.type);
      }
    }

    case "PReference": {
      const t = scope.get(expr.name).type;
      return (t instanceof UnresolvedType) ? t.resolved() : t;
    }

    // FIXME: PArray

    case "PStruct": {
      const fields = expr.children.map(field => {
        return new CTypedField(field.name, computeType(field.children[0], errors, scope, typeScope, logger));
      });
      return new CompoundType(fields);
    }

    case "PNew": return expr.newType;

    case "PCall": {
      const [ targetType, argType ] = expr.children.map(node => computeType(node, errors, scope, typeScope, logger));
      const message = expr.children[1];
      const isSymbol = message.nodeType == "PConstant" && message.type == PConstantType.SYMBOL;
      if (logger) logger(`call: ${targetType.inspect()} ${APPLY_SYMBOL} ${dumpExpr(message)}: ${argType.inspect()}`);

      let rtype = null;
      // let symbol resolution try first.
      if (isSymbol) rtype = targetType.handlerTypeForSymbol(message.value);
      if (rtype == null) {
        const { coerceType, type } = targetType.handlerTypeForMessage(argType);
        if (coerceType != null) {
          expr.coerceType = coerceType;
          if (logger) logger(`call:   \u21b3 coerce to: ${coerceType.inspect()}`);
        }
        rtype = type;
      }
      if (rtype == null) {
        // special-case "Anything", which bails out of type-checking.
        if (!targetType.anything) errors.add("No matching handler found", expr.span);
        rtype = typeScope.get("Anything");
      }
      // if the return type was annotated, use that (for now).
      if (rtype instanceof UnresolvedType) {
        rtype = rtype.flatten();
      }
      if (logger) logger(`call:   \u21b3 ${rtype.inspect()}`);
      return rtype;
    }

    case "PLogic": {
      expr.children.forEach(node => {
        if (!computeType(node, errors, scope, typeScope, logger).isType(typeScope.get("Boolean"))) {
          errors.add("Logical operations require a boolean", node.span);
        }
      });
      return typeScope.get("Boolean");
    }

    case "PAssignment": {
      const types = expr.children.map(n => computeType(n, errors, scope, typeScope, logger));
      if (!types[0].canAssignFrom(types[1])) {
        errors.add(`Incompatible types in assignment: ${types[0].inspect()} := ${types[1].inspect()}`, expr.span);
      }
      return types[0];
    }

    case "PIf": {
      const condType = computeType(expr.children[0], errors, scope, typeScope, logger);
      if (!condType.isType(typeScope.get("Boolean"))) {
        errors.add("Conditional expression must be true or false", expr.children[0].span);
      }
      return mergeTypes(expr.children.slice(1).map(n => computeType(n, errors, scope, typeScope, logger)), logger);
    }

    // - PRepeat
    // - PReturn
    // - PBreak

    case "PLocals": return typeScope.get("Nothing");

    case "POn": return typeScope.get("Nothing");

    case "PBlock": {
      let rtype = typeScope.get("Nothing");
      expr.children.forEach(n => {
        // hit every node so we collect errors.
        rtype = computeType(n, errors, expr.scope, typeScope, logger);
      });
      return rtype;
    }

    default:
      throw new Error("Unimplemented expression type: " + expr.nodeType);
  }
}

export function typecheck(expr, errors, scope, typeScope, logger) {
  if (logger) logger(`typecheck: ${dumpExpr(expr)}`);
  const unresolved = buildScopes(expr, errors, scope, typeScope);
  resolveTypes(expr, unresolved, errors, logger);
  return computeType(expr, errors, scope, typeScope, logger);
}
