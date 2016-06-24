"use strict";

/*
 * FIXME: TODO:
 *
 *   - check that the declared type of a 'new' matches the created type
 */

import { PConstantType } from "../common/ast";
import { dumpExpr } from "../dump";
import { compileType } from "./c_type";
import { Scope } from "./scope";
import { CompoundType, CTypedField, mergeTypes, newType, TNoType, TypeDescriptor } from "./type_descriptor";

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

  // collect unprocessed "on" expressions to run at the end of the block.
  let handlers = [];

  // stack of the "current" scope, typeScope, any type being defined, and free variables in an unresolved expression.
  const stack = [];

  // list of UnresolvedType objects we created.
  const unresolved = [];

  visit(expr);
  handlers.forEach(state => {
    save();
    restoreTo(state);
    visit(state.node, { handlers: true });
    restore();
  });
  return unresolved;

  function save() {
    stack.push({ scope, typeScope, type, variables, handlers });
  }

  function restore() {
    // babel can't handle this kind of deconstruction.
    restoreTo(stack.pop());
  }

  function restoreTo(state) {
    scope = state.scope;
    typeScope = state.typeScope;
    type = state.type;
    variables = state.variables;
    handlers = state.handlers;
  }

  function visit(node, options = {}) {
    // create scopes.
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
          const ltype = new UnresolvedType(node.children[0], scope, typeScope);
          unresolved.push(ltype);
          variables = ltype.variables;
          scope.add(node.name, new CReference(node.name, ltype, node.mutable));
        }
        break;
      }

      case "POn": {
        if (!options.handlers) {
          // punt!
          handlers.push({ node, scope, typeScope, type, variables, handlers });
          return;
        } else {
          // mark return type as unresolved. we'll figure it out when we shake the bucket later.
          const rtype = new UnresolvedType(node.children[1], scope, typeScope);
          unresolved.push(rtype);
          if (node.children[2] != null) {
            // trust the type annotation for now. (we'll check later.)
            rtype.annotatedType = compileType(node.children[2], errors, typeScope);
            node.children[1].coerceType = rtype.annotatedType;
          } else {
            variables.push(rtype);
          }
          variables = rtype.variables;
          if (node.children[0].nodeType == "PCompoundType") {
            const guardType = compileType(node.children[0], errors, typeScope);
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

      case "PTypedField": {
        if (node.defaultValue != null) {
          const rtype = new UnresolvedType(node.defaultValue, scope, typeScope);
          unresolved.push(rtype);
          // trust the type annotation for now. (we'll check later.)
          rtype.annotatedType = compileType(node.type, errors, typeScope);
          node.defaultValue.coerceType = rtype.annotatedType;
          variables = rtype.variables;
        }
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
      handlers.forEach(state => {
        save();
        restoreTo(state);
        visit(state.node, { handlers: true });
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

    if (node.coerceType && node.computedType && !node.coerceType.canAssignFrom(node.computedType)) {
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
  const Nothing = typeScope.get("Nothing");
  const Anything = typeScope.get("Anything");
  const Boolean = typeScope.get("Boolean");

  // track escapes ('return') and breaks ('break')
  const escapePod = [];
  let breaks = [];
  const rtype = visit(expr, scope);
  return (escapePod.length > 0) ? mergeTypes(escapePod.concat(rtype)) : rtype;

  function visit(node, scope) {
    if (logger) logger(`computeType ->: ${dumpExpr(node)}`);
    const rv = _visit(node, scope);
    if (logger) logger(`computeType <-: ${dumpExpr(node)} == ${rv.inspect()}`);
    return rv;
  }

  function _visit(node, scope) {
    switch (node.nodeType) {
      case "PConstant": {
        switch (node.type) {
          case PConstantType.NOTHING: return typeScope.get("Nothing");
          case PConstantType.BOOLEAN: return typeScope.get("Boolean");
          case PConstantType.SYMBOL: return typeScope.get("Symbol");
          case PConstantType.NUMBER_BASE10: return typeScope.get("Int");
          case PConstantType.NUMBER_BASE16: return typeScope.get("Int");
          case PConstantType.NUMBER_BASE2: return typeScope.get("Int");
          case PConstantType.STRING: return typeScope.get("String");
          default: throw new Error("Internal error: No such constant type " + node.type);
        }
      }

      case "PReference": {
        const t = scope.get(node.name).type;
        return (t instanceof UnresolvedType) ? t.resolved() : t;
      }

      // FIXME: PArray

      case "PStruct": {
        const fields = node.children.map(field => {
          return new CTypedField(field.name, visit(field.children[0], scope));
        });
        return new CompoundType(fields);
      }

      case "PNew": return node.newType;

      case "PCall": {
        const [ targetType, argType ] = node.children.map(n => visit(n, scope));
        const message = node.children[1];
        const isSymbol = message.nodeType == "PConstant" && message.type == PConstantType.SYMBOL;
        if (logger) logger(`call: ${targetType.inspect()} ${APPLY_SYMBOL} ${dumpExpr(message)}: ${argType.inspect()}`);

        let rtype = null;
        if (!targetType.canCall) {
          errors.add("Combo type can't be invoked; use 'match' to figure out the type first", node.span);
          rtype = Anything;
        } else {
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
            // FIXME: might be better to make Anything be an error too, and require a 'match'.
            if (!targetType.anything) errors.add("No matching handler found", node.span);
            rtype = Anything;
          }
        }

        if (rtype instanceof UnresolvedType) rtype = rtype.resolved();
        if (logger) logger(`call:   \u21b3 ${rtype.inspect()}`);
        return rtype;
      }

      case "PLogic": {
        node.children.forEach(n => {
          if (!visit(n, scope).isType(Boolean)) {
            errors.add("Logical operations require a boolean", n.span);
          }
        });
        return Boolean;
      }

      case "PAssignment": {
        const types = node.children.map(n => visit(n, scope));
        if (!types[0].canAssignFrom(types[1])) {
          errors.add(`Incompatible types in assignment: ${types[0].inspect()} := ${types[1].inspect()}`, node.span);
        }
        return types[0];
      }

      case "PIf": {
        const condType = visit(node.children[0], scope);
        if (!condType.isType(Boolean)) {
          errors.add("Conditional expression must be true or false", node.children[0].span);
        }
        return mergeTypes(node.children.slice(1).map(n => visit(n, scope)));
      }

      case "PRepeat": {
        const oldBreaks = breaks;
        breaks = [];
        node.children.forEach(n => visit(n, scope));
        // it's okay for there to be no 'break' inside; might be a 'return'.
        const rtype = (breaks.length == 0) ? Nothing : mergeTypes(breaks);
        breaks = oldBreaks;
        return rtype;
      }

      case "PReturn": {
        escapePod.push(visit(node.children[0], scope));
        return TNoType;
      }

      case "PBreak": {
        if (node.children[0]) breaks.push(visit(node.children[0], scope));
        return TNoType;
      }

      case "PLocals": return Nothing;

      case "POn": return Nothing;

      case "PBlock": {
        let rtype = Nothing;
        // a bare return means anything after it is dead code, and there's no fallback return type.
        let bareReturn = false, deadCode = false;
        node.children.forEach(n => {
          if (bareReturn && !deadCode) {
            errors.add("Unreachable code after 'return'", n.span);
            deadCode = true;
          }
          if (n.nodeType == "PReturn") bareReturn = true;
          // hit every node so we collect errors.
          rtype = visit(n, node.scope);
        });
        return bareReturn ? TNoType : rtype;
      }

      default:
        throw new Error("Unimplemented expression type: " + node.nodeType);
    }
  }
}

export function typecheck(expr, errors, scope, typeScope, logger) {
  if (logger) logger(`typecheck: ${dumpExpr(expr)}`);
  const unresolved = buildScopes(expr, errors, scope, typeScope);
  resolveTypes(expr, unresolved, errors, logger);
  return computeType(expr, errors, scope, typeScope, logger);
}
