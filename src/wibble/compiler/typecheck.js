"use strict";

import { PConstantType } from "../common/ast";
import { transformAst } from "../common/transform";
import { dumpExpr } from "../dump";
import { compileType } from "./c_type";
import { Scope } from "./scope";
import { CompoundType, CTypedField, mergeTypes, newType } from "./type_descriptor";

const APPLY_SYMBOL = "\u2053";

export class CReference {
  constructor(name, type, mutable) {
    this.name = name;
    this.type = type;
    this.mutable = mutable;
  }
}

/*
 * 1. Attach a new (locals) scope to each block and handler.
 * xxx2. Attach an unknown-type reference to each local and handler.
 * 3. Catch unresolved references and duplicate names.
 *
 * FIXME: ensure types in PCompoundType are checked.
 *
 * - scope: name -> CReference
 */
export function buildScopes(expr, errors, scope, typeScope, logger) {
  let type = null;

  // keep breadcrumbs of the path we took to get to this node.
  const path = [];
  // stacks of the "current" scope, typeScope, and any type being defined.
  const scopeStack = [];
  const typeScopeStack = [];
  const typeStack = [];

  transformAst(expr, {
    enter: node => {
      path.push(node);
      scopeStack.push(scope);
      typeScopeStack.push(typeScope);
      typeStack.push(type);
    },
    exit: () => {
      path.pop();
      scope = scopeStack.pop();
      typeScope = typeScopeStack.pop();
      type = typeStack.pop();
    },
    // allow expressions inside a handler to make forward references.
    postpone: [ "POn" ]
  }, node => {
    const nodeType = node.constructor.name;

    switch (nodeType) {
      case "PReference": {
        if (scope.get(node.name) == null) {
          errors.add(`Undefined reference '${node.name}'`, node.span);
          // stub in an "Anything" immutable so we can plug onward.
          scope.add(node.name, new CReference(node.name, typeScope.get("Anything"), false));
        }
        return null;
      }

      case "PNew": {
        // attach a new (blank) type that we'll fill with handlers.
        node.newType = type = newType();
        if (node.children[0].constructor.name == "PBlock") {
          // new -> block: push a new scope & typeScope with "@" defined.
          node.scope = scope = new Scope(scope);
          scope.add("@", new CReference("@", type, false));
          typeScope = new Scope(typeScope);
          typeScope.add("@", type);
        }
        return null;
      }

      case "PAssignment": {
        const name = node.children[0].name;
        const rtype = scope.get(name);
        if (rtype == null) {
          errors.add(`Undefined reference '${name}'`, node.children[0].span);
          return null;
        }
        if (!rtype.mutable) errors.add(`Assignment to immutable (let) '${name}'`, node.children[0].span);
        return null;
      }

      case "PLocal": {
        if (scope.get(node.name) != null) {
          errors.add(`Redefined local '${node.name}'`, node.span);
        }
        return null;
      }

      case "POn": {
        if (node.children[0].constructor.name == "PCompoundType") {
          // open up a new scope for the parameters.
          node.scope = scope = new Scope(scope);
          node.children[0].children.forEach(field => {
            const ftype = compileType(field.type, errors, typeScope);
            scope.add(field.name, new CReference(field.name, ftype, false));
          });
        }
        return null;
      }

      case "PBlock": {
        node.scope = scope = new Scope(scope);
        return null;
      }

      default:
        return null;
    }
  }, node => {
    // late transform: after child nodes have been traversed.
    const nodeType = node.constructor.name;

    switch (nodeType) {
      case "PLocal": {
        // don't add a local to scope until we've traversed the value expression & it's ready for 'computeType'.
        const rtype = computeType(node.children[0], errors, scope, typeScope, logger);
        scope.add(node.name, new CReference(node.name, rtype, node.mutable));
        return null;
      }

      case "POn": {
        const rtype = computeType(node.children[1], errors, scope, typeScope, logger);
        if (node.children[0].constructor.name == "PCompoundType") {
          const guardType = compileType(node.children[0], errors, typeScope);
          type.addTypeHandler(guardType, rtype);
        } else {
          type.addSymbolHandler(node.children[0].value, rtype);
        }
        return null;
      }

      default:
        return null;
    }
  });
}


/*
 * unresolved:
 *   - alias type "@" to the nearest outer "new"
 *   - when a type is explicitly given, verify that it matches our inferred type.
 *   - recursion? (nail-biter)
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
  switch (expr.constructor.name) {
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

    case "PReference": return scope.get(expr.name).type;

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
      const isSymbol = message.constructor.name == "PConstant" && message.type == PConstantType.SYMBOL;
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
      throw new Error("Unimplemented expression type: " + expr.constructor.name);
  }
}

export function typecheck(expr, errors, scope, typeScope, logger) {
  if (logger) logger(`typecheck: ${dumpExpr(expr)}`);
  buildScopes(expr, errors, scope, typeScope, logger);
  return computeType(expr, errors, scope, typeScope, logger);
}
