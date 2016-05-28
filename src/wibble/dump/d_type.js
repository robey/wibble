"use strict";

import { dumpExpr } from "./d_expr";

/*
 * dump types
 */

export function dumpType(t) {
  function nested(t2) {
    const rv = dumpType(t2);
    return t2.children.length > 0 && t2.precedence > t.precedence ? "(" + rv + ")" : rv;
  }

  switch (t.constructor.name) {
    case "PSimpleType":
      return t.name;
    case "PCompoundType":
      return "(" + t.children.map(dumpTypedField).join(", ") + ")";
    case "PTemplateType":
      return t.name + "(" + t.children.map(dumpType).join(", ") + ")";
    case "PParameterType":
      return "$" + t.name;
    case "PFunctionType":
      return nested(t.argType) + " -> " + nested(t.resultType);
    case "PMergedType":
      return t.children.map(nested).join(" | ");
    default:
      return `???(${t.constructor.name})`;
  }
}

function dumpTypedField(f) {
  return f.name + (f.type ? `: ${dumpType(f.type)}` : "") + (f.defaultValue ? ` = ${dumpExpr(f.defaultValue)}` : "");
}
