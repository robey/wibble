"use strict";

import { PType } from "../common/ast";
import { newCompoundType, CTypedField, mergeTypes, newType, newWildcard } from "./type_descriptor";

/*
 * compile an AST type into a type descriptor.
 */
export function compileType(expr, errors, typeScope, assignmentChecker) {
  if (!(expr instanceof PType)) throw new Error("Internal error: compileType on non-PType");

  const compile = node => {
    switch(node.nodeType) {
      case "PSimpleType": {
        if (typeScope.get(node.name) == null) {
          errors.add(`Unresolved type '${node.name}'`, node.span);
          return typeScope.get("Anything");
        }
        return typeScope.get(node.name);
      }

      case "PCompoundType": {
        // check for repeated fields.
        const seen = {};
        node.children.forEach(f => {
          if (seen[f.name]) errors.add(`Field name ${f.name} is repeated`, f.span);
          seen[f.name] = true;
        });
        return newCompoundType(node.children.map(f => {
          return new CTypedField(f.name, compile(f.type), f.defaultValue);
        }));
      }

      // FIXME: PTemplateType(name)

      case "PParameterType": {
        const name = "$" + node.name;
        if (typeScope.get(name) != null) return typeScope.get(name);
        const type = newWildcard(name);
        return type;
      }

      case "PFunctionType": {
        const type = newType();
        type.addTypeHandler(compile(node.argType), compile(node.resultType));
        return type;
      }

      // - PMergedType
      case "PMergedType": {
        return mergeTypes(node.children.map(compile), assignmentChecker);
      }
    }
  };

  const rtype = compile(expr);
  return rtype;
}
