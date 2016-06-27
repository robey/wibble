"use strict";

import { PConstantType } from "../common/ast";
import { dumpExpr } from "../dump";
import { CompoundType, CTypedField, mergeTypes, NoType } from "./type_descriptor";

const APPLY_SYMBOL = "\u2053";

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
        return scope.get(node.name).type.resolved;
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
          errors.add("Wildcard or combo type can't be invoked; use 'match' to figure out the type first", node.span);
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

        rtype = rtype.resolved;
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
        return NoType;
      }

      case "PBreak": {
        if (node.children[0]) breaks.push(visit(node.children[0], scope));
        return NoType;
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
        return bareReturn ? NoType : rtype;
      }

      default:
        throw new Error("Unimplemented expression type: " + node.nodeType);
    }
  }
}
