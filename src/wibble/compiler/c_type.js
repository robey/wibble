"use strict";

import { PType } from "../common/ast";
import { CompoundType, CTypedField, mergeTypes, newType, ParameterType } from "./type_descriptor";

/*
 * compile an AST type into a type descriptor.
 */
export function compileType(expr, errors, scope, logger) {
  if (!(expr instanceof PType)) throw new Error("Internal error: compileType on non-PType");

  const compile = node => {
    switch(node.nodeType) {
      case "PSimpleType": {
        if (scope.get(node.name) == null) {
          errors.add(`Unresolved type '${node.nome}'`);
          return scope.get("Anything");
        }
        return scope.get(node.name);
      }

      case "PCompoundType": {
        // check for repeated fields.
        const seen = {};
        node.children.forEach(f => {
          if (seen[f.name]) errors.add(`Field name ${f.name} is repeated`, f.span);
          seen[f.name] = true;
        });
        return new CompoundType(node.children.map(f => {
          return new CTypedField(f.name, compile(f.type), f.defaultValue);
        }));
      }

      // FIXME: PTemplateType(name)

      case "PParameterType": {
        const name = "$" + node.name;
        if (scope.get(name) != null) return scope.get(name);
        return new ParameterType(name);
      }

      case "PFunctionType": {
        const type = newType();
        type.addTypeHandler(compile(node.argType), compile(node.resultType));
        return type;
      }

      // - PMergedType
      case "PMergedType": {
        return mergeTypes(node.children.map(compile), logger);
      }
    }
  };

  return compile(expr);
}
