"use strict";

import { PCall, PConstant, PConstantType, PLogic, PNew, POn } from "../common/ast";
import { State, transformAst } from "../common/transform";

export function simplify(ast, state) {
  if (!state) state = new State();

  return transformAst(ast, state, node => {
    const nodeType = node.constructor.name;

    // if (nodeType == "PNew") {
    //   state.set("object", true);
    // } else if ()

    switch (nodeType) {
      case "PUnary": {
        // convert unary(op)(a) into call(a, op)
        const op = node.op == "-" ? "negative" : node.op;
        const symbol = new PConstant(PConstantType.SYMBOL, op, node.span);
        return new PCall(node.children[0], symbol, node.span);
      }

      case "PBinary": {
        // convert binary(logic-op)(a, b) into logic(logic-op)(a, b)
        if (node.op == "or" || node.op == "and") {
          return new PLogic(node.children[0], node.op, node.children[1], node.span);
        }
        // convert binary(op)(a, b) into call(call(a, op), b)
        const symbol = new PConstant(PConstantType.SYMBOL, node.op, node.span);
        return new PCall(new PCall(node.children[0], symbol, node.span), node.children[1], node.span);
      }

      case "PIf": {
        // ensure every "if" has an "else".
        if (node.children.length < 3) node.children.push(new PConstant(PConstantType.NOTHING));
        return null;
      }

      case "PStruct": {
        // convert positional fields into named fields. (adds a name in-place)
        let positional = true;
        const seen = {};

        node.children.forEach((field, i) => {
          if (field.name == null) {
            if (!positional) state.errors.add("Positional fields can't come after named fields", field.span);
            field.name = `?${i}`;
          } else {
            positional = false;
            if (seen[field.name]) state.errors.add(`Field name '${field.name}' is repeated`, field.span);
            seen[field.name] = true;
          }
        });
        return null;
      }

      case "PFunction": {
        // convert function(inType, a, outType) into new(on(inType, a, outType)).
        return new PNew(new POn(node.children[0], node.children[1], node.children[2], node.span));
      }
    }
  });
}




// # "on" handlers must be in a "new" block, and a "new" block must contain at least one "on" handler.
// checkHandlers = (expr) ->
//   t_expr.digExpr expr, false, (expr, inNew) ->
//     if expr.on? and not inNew
//       error("'on' handlers must be inside a type definition or 'new' expression", expr.on.state)
//     if expr.newObject?
//       handlers = expr.newObject.code.filter (x) -> x.on?
//       if handlers.length == 0
//         error("'new' expression must contain at least one 'on' handler", expr.newObject.state)
//     [ expr, expr.newObject? or (inNew and expr.code?) ]
