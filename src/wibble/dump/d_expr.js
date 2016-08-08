"use strict";

import { PConstantType } from "../common/ast";
import { cstring } from "../common/strings";
import { dumpType } from "./d_type";

/*
 * dump expressions
 */

export function dumpExpr(expr) {
  function nested(expr2, left = false) {
    const rv = dumpExpr(expr2);
    const childCount = (expr2.children || []).length;
    const lower = left ? (expr2.precedence > expr.precedence) : (expr2.precedence >= expr.precedence);
    if (childCount > 1 && lower) return "(" + rv + ")";
    return rv;
  }

  switch (expr.constructor.name) {
    case "PConstant":
      return dumpConstant(expr);
    case "PReference":
      return expr.name;
    case "PArray":
      if (expr.children.length == 0) return "[]";
      return "[ " + expr.children.map(dumpExpr).join(", ") + " ]";
    case "PFunction":
      return (expr.inType ? dumpType(expr.inType) : "") +
        (expr.outType ? ": " + dumpType(expr.outType) : "") +
        (expr.inType ? " " : "") + "-> " + nested(expr.children[1]);
    case "PStruct":
      return "(" + expr.children.map(dumpExpr).join(", ") + ")";
    case "PStructField":
      return (expr.name ? expr.name + "=" : "") + dumpExpr(expr.children[0]);
    case "PNew":
      return "new " + nested(expr.children[0]);
    case "PUnary":
      return (expr.op == "-" ? expr.op : (expr.op + " ")) + nested(expr.children[0]);
    case "PCall":
      return nested(expr.children[0], true) + " " + nested(expr.children[1]);
    case "PBinary":
      return nested(expr.children[0], true) + " " + expr.op + " " + nested(expr.children[1]);
    case "PLogic":
      return nested(expr.children[0], true) + " " + expr.op + " " + nested(expr.children[1]);
    case "PAssignment":
      return nested(expr.children[0]) + " := " + nested(expr.children[1]);
    case "PIf":
      return `if ${nested(expr.children[0])} then ${nested(expr.children[1])}` +
        (expr.children.length > 2 ? ` else ${nested(expr.children[2])}` : "");
    case "PRepeat":
      return "repeat " + dumpExpr(expr.children[0]);
    case "PWhile":
      return "while " + nested(expr.children[0]) + " do " + dumpExpr(expr.children[1]);
    case "PReturn":
      return "return " + dumpExpr(expr.children[0]);
    case "PBreak":
      return "break" + (expr.children.length > 0 ? ` ${dumpExpr(expr.children[0])}` : "");
    case "PLocals":
      return (expr.mutable ? "make " : "let ") + expr.children.map(n => dumpExpr(n)).join(", ");
    case "PLocal":
      return expr.name + (expr.mutable ? " := " : " = ") + dumpExpr(expr.children[0]);
    case "POn":
      return "on " + (expr.children[0].constructor.name == "PConstant" ? dumpExpr : dumpType)(expr.children[0]) +
        (expr.children.length > 2 ? `: ${dumpType(expr.children[2])}` : "") +
        " -> " + dumpExpr(expr.children[1]);
    case "PBlock":
      return "{ " + expr.children.map(dumpExpr).join("; ") + " }";
    default:
      return `???(${expr.constructor.name})`;
  }
}

function dumpConstant(c) {
  switch (c.type) {
    case PConstantType.NOTHING:
      return "()";
    case PConstantType.BOOLEAN:
      return c.value ? "true" : "false";
    case PConstantType.SYMBOL:
      return "." + c.value;
    case PConstantType.NUMBER_BASE10:
      return c.value;
    case PConstantType.NUMBER_BASE16:
      return "0x" + c.value;
    case PConstantType.NUMBER_BASE2:
      return "0b" + c.value;
    case PConstantType.STRING:
      return "\"" + cstring(c.value) + "\"";
    default:
      return `???(${PConstantType[c.type]})`;
  }
}
