"use strict";

import { PConstantType, PTypedField } from "../common/ast";
import { transformAst } from "../common/transform";
import { CompoundType } from "./type_descriptor";
import { Scope } from "./scope";

class MysteryType {
  constructor(name, mutable) {
    this.name = name;
    this.mutable = mutable;
  }
}

/*
 * 1. Attach a new (locals) scope to each block and handler.
 * 2. Attach an unknown-type reference to each local and handler.
 * 3. Catch unresolved references and duplicate names.
 */
export function buildScopes(expr, errors, scope) {
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
        if (scope.get(node.name) == null) errors.add(`Undefined reference '${node.name}'`, node.span);
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
        scope.add(name, new MysteryType(name, node.mutable));
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
 * the scope is required to have the built-in types (Nothing, Int, ...)
 * defined so that constants can be type-checked.
 */
export function computeType(expr, scope, logger) {
  logger;

  switch (expr.constructor.name) {
    case "PConstant": {
      switch (expr.type) {
        case PConstantType.NOTHING: return scope.get("Nothing");
        case PConstantType.BOOLEAN: return scope.get("Boolean");
        case PConstantType.SYMBOL: return scope.get("Symbol");
        case PConstantType.NUMBER_BASE10: return scope.get("Int");
        case PConstantType.NUMBER_BASE16: return scope.get("Int");
        case PConstantType.NUMBER_BASE2: return scope.get("Int");
        case PConstantType.STRING: return scope.get("String");
        default: throw new Error("Internal error: No such constant type " + expr.type);
      }
    }

    case "PReference": {
      return scope.get(expr.name);
    }

    // FIXME: PArray

    case "PStruct": {
      const fields = expr.children.map(field => {
        return new PTypedField(field.name, computeType(field.children[0], scope, logger));
      });
      return new CompoundType(fields);
    }

    // - PNew
    // - PCall
    // - PLogic(op)
    // - PAssignment
    // - PIf
    // - PRepeat
    // - PReturn
    // - PBreak

    default:
      throw new Error("Unimplemented expression type: " + expr.constructor.name);
  }
}

export function typecheck(expr, errors, scope, logger) {
  buildScopes(expr, errors, scope);
  return computeType(expr, scope, logger);
}
