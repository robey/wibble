"use strict";

import { PConstantType } from "../common/ast";
import { transformAst } from "../common/transform";
import { dumpExpr } from "../dump";
import { CompoundType, CTypedField, mergeTypes } from "./type_descriptor";
import { Scope } from "./scope";

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
  // stacks of the "current" scope and type.
  const scopeStack = [];
  const typeStack = [];

  transformAst(expr, {
    enter: node => {
      path.push(node);
      scopeStack.push(scope);
      typeStack.push(type);
    },
    exit: () => {
      path.pop();
      scope = scopeStack.pop();
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
          scope.add(new CReference(node.name, typeScope.get("Anything"), false));
        }
        return null;
      }

      case "PAssignment": {
        const name = node.children[0].name;
        const type = scope.get(name);
        if (type == null) {
          errors.add(`Undefined reference '${name}'`, node.children[0].span);
          return null;
        }
        if (!type.mutable) errors.add(`Assignment to immutable (let) '${name}'`, node.children[0].span);
        return null;
      }

      case "PLocal": {
        const name = node.children[0].name;
        if (scope.get(name) != null) {
          errors.add(`Redefined local '${name}'`, node.children[0].span);
        }
        const type = computeType(node.children[1], errors, scope, typeScope, logger);
        scope.add(name, new CReference(name, type, node.mutable));
        return null;
      }

      case "PBlock": {
        expr.scope = scope = new Scope(scope);
        return null;
      }

      default:
        return null;
    }
  });




  Scope;

}

/*
 * unresolved:
 *   - alias type "@" to the nearest outer "new"
 *   - when a type is explicitly given, verify that it matches our inferred type.
 */


 // t_expr.digExpr expr, tstate, (expr, tstate) ->
 //   findType = (type) -> t_type.findType(type, tstate.typemap)

 // if expr.newObject?
 //   # attach a new (blank) type that we'll fill in with handlers
 //   tstate = tstate.newType()
 //   if not expr.stateless
 //     # open a new scope too
 //     tstate = tstate.newScope()
 //     tstate.scope.add("@", tstate.type)
 //     tstate.typemap.add("@", new t_type.SelfType(tstate.type))
 //   return [ copy(expr, newType: tstate.type, scope: tstate.scope, typemap: tstate.typemap), tstate ]
 //
 //   if expr.on?
 //     # code inside a handler is allowed to make forward references, so stop
 //     # checking for now. (we'll do another pass for these later.)
 //     tstate = tstate.stopCheckingReferences()
 //     type = if expr.type? then findType(expr.type) else new UnknownType("handler")
 //     if expr.on.compoundType?
 //       # open up a new (chained) scope, with references for the parameters
 //       tstate = tstate.newScope()
 //       for p in expr.on.compoundType
 //         tstate.scope.add(p.name, if p.type? then findType(p.type) else descriptors.DAny)
 //       tstate.type.addTypeHandler findType(expr.on), type
 //       return [ copy(expr, scope: tstate.scope, typemap: tstate.typemap, unresolved: type, type: null), tstate ]
 //     else
 //       tstate.type.addValueHandler expr.on.symbol, type
 //       return [ copy(expr, unresolved: type, type: null), tstate ]
 //
 //   if expr.code?
 //     tstate = tstate.newScope()
 //     return [ copy(expr, scope: tstate.scope, typemap: tstate.typemap), tstate ]

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

    case "PReference": {
      if (scope.get(expr.name)) return scope.get(expr.name).type;
      // buildScopes will catch the undefined reference.
      return typeScope.get("Anything");
    }

    // FIXME: PArray

    case "PStruct": {
      const fields = expr.children.map(field => {
        return new CTypedField(field.name, computeType(field.children[0], errors, scope, typeScope, logger));
      });
      return new CompoundType(fields);
    }

    // - PNew

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
          if (logger) logger(`call:   \u21b3 coerce to: ${type.inspect()}`);
        }
        rtype = type;
      }
      if (rtype == null) {
        errors.add("No matching handler found", expr.span);
        rtype = scope.get("Anything");
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

    // if expr.newObject? then return expr.newType
    //
    // if expr.local? then return tstate.scope.get(expr.local.name).type


    // - PRepeat
    // - PReturn
    // - PBreak

    case "PLocals": {
      return typeScope.get("Nothing");
    }

    // - POn
    // - PBlock

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
  buildScopes(expr, errors, scope, typeScope, logger);
  return computeType(expr, errors, scope, typeScope, logger);
}
