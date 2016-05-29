"use strict";

import { PType } from "../common/ast";
import { CompoundType, CTypedField, MergedType, newType } from "./type_descriptor";

/*
 * compile an AST type into a type descriptor.
 */
export function compileType(node, errors, scope) {
  if (!(node instanceof PType)) throw new Error("Internal error: compileType on non-PType");

  switch(node.constructor.name) {
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
        return new CTypedField(f.name, compileType(f.type, errors, scope), f.defaultValue);
      }));
    }

    // FIXME: PTemplateType(name)

    case "PParameterType": {
      const name = "$" + node.name;
      if (scope.get(name) != null) return scope.get(name);
      return newType(name);
    }

    case "PFunctionType": {
      const type = newType();
      type.addTypeHandler(compileType(node.argType, errors, scope), compileType(node.resultType, errors, scope));
      return type;
    }

    // - PMergedType
    case "PMergedType": {
      return new MergedType(node.children.map(t => compileType(t, errors, scope)));
    }
  }
}
