"use strict";

import { PType } from "../common/ast";
import { newCompoundType, CTypedField, mergeTypes, newType, ParameterType } from "./type_descriptor";

/*
 * compile an AST type into a type descriptor.
 */
export function compileType(expr, errors, scope, logger) {
  if (!(expr instanceof PType)) throw new Error("Internal error: compileType on non-PType");

  // if a wildcard name appears multiple times, use the same type descriptor
  // name -> type
  const wildcards = {};

  const compile = node => {
    switch(node.nodeType) {
      case "PSimpleType": {
        if (scope.get(node.name) == null) {
          errors.add(`Unresolved type '${node.name}'`, node.span);
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
        return newCompoundType(node.children.map(f => {
          return new CTypedField(f.name, compile(f.type), f.defaultValue);
        }));
      }

      // FIXME: PTemplateType(name)

      case "PParameterType": {
        const name = "$" + node.name;
        if (scope.get(name) != null) return scope.get(name);
        if (wildcards.hasOwnProperty(name)) return wildcards[name];
        const type = new ParameterType(name);
        wildcards[name] = type;
        return type;
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

  const rtype = compile(expr);
  rtype.wildcards = Object.keys(wildcards).map(key => wildcards[key]);
  return rtype;
}
