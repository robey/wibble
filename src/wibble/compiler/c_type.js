"use strict";

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

    }
  }

  // - PSimpleType(name)
  // - PCompoundType
  //   - PTypedField(name, type, defaultValue, span)
  // - PTemplateType(name)
  // - PParameterType(name)
  // - PFunctionType(argType, resultType)
  // - PDisjointType


//     if type.compoundType?
//       descriptors = require './descriptors'
//       checkCompoundType(type)
//       fields = type.compoundType.map (f) ->
//         # FIXME warning: not type checked
//         type = if f.type? then findType(f.type, typemap) else descriptors.DAny
//         { name: f.name, type, value: f.value }
//       return new CompoundType(fields)
//     if type.functionType? then return functionType(findType(type.argType, typemap), findType(type.functionType, typemap))
//     if type.disjointType?
//       options = type.disjointType.map (t) -> findType(t, typemap)
//       return new DisjointType(options)
//     if type.parameterType?
//       name = "$" + type.parameterType
//       t = typemap.get(name)?.type
//       if t? then return t
//       t = new ParameterType(name)
//       typemap.add(name, t)
//       return t
//     error "Not implemented yet: template type"
//
//   # check for repeated fields before it's too late
//   checkCompoundType = (type) ->
//     seen = {}
//     for f in type.compoundType
//       if seen[f.name] then error("Field name #{f.name} is repeated", f.state)
//       seen[f.name] = true
// }
