"use strict";

import { PType } from "../common/ast";
import { Scope } from "./scope";
import { newCompoundType, CTypedField, mergeTypes, newType, newWildcard } from "./type_descriptor";

/*
 * compile an AST type into a type descriptor.
 */
export function compileType(expr, errors, typeScope, assignmentChecker, allowNewWildcards = true) {
  if (!(expr instanceof PType)) throw new Error("Internal error: compileType on non-PType");

  const compile = node => {
    switch(node.nodeType) {
      case "PSimpleType": {
        if (typeScope.get(node.name) == null) {
          errors.add(`Unresolved type '${node.name}'`, node.span);
          return typeScope.get("Anything");
        }
        const type = typeScope.get(node.name);
        if (type.wildcards.length > 0) {
          errors.add(
            `Type ${node.name} requires type parameters ${type.wildcards.map(t => t.inspect()).join(", ")}`,
            node.span
          );
        }
        return type;
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

      case "PTemplateType": {
        if (typeScope.get(node.name) == null) {
          errors.add(`Unresolved type '${node.name}'`, node.span);
          return typeScope.get("Anything");
        }
        const type = typeScope.get(node.name);
        const wildcards = type.wildcards;
        const parameters = node.children.map(compile);
        if (wildcards.length != parameters.length) {
          errors.add(`Type ${node.name} requires ${wildcards.length} type parameters`, node.span);
          while (parameters.length < wildcards.length) parameters.push(typeScope.get("Anything"));
        }

        // fill in wildcards!
        const newTypeScope = new Scope(typeScope);
        for (let i = 0; i < wildcards.length; i++) {
          newTypeScope.add(wildcards[i].name, parameters[i]);
        }
        return assignmentChecker.resolve(type, newTypeScope);
      }

      case "PParameterType": {
        const name = "$" + node.name;
        if (typeScope.get(name) != null) return typeScope.get(name);
        if (!allowNewWildcards) {
          errors.add("Can't introduce a new wildcard here", node.span);
          return typeScope.get("Anything");
        }
        const rtype = newWildcard(name);
        typeScope.add(name, rtype);
        return rtype;
      }

      case "PFunctionType": {
        const type = newType();
        type.addTypeHandler(compile(node.argType), compile(node.resultType));
        return type;
      }

      case "PMergedType": {
        return mergeTypes(node.children.map(compile), assignmentChecker);
      }
    }
  };

  const rtype = compile(expr);
  return rtype;
}
