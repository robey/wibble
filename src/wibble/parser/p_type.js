"use strict";

import $ from "packrattle";
import { linespace, repeatSeparated, repeatSurrounded, TYPE_NAME } from "./p_common";
import { expression, reference } from "./p_expr";

/*
 * parse type declarations.
 */

class PType {
  constructor(description, span, children) {
    this.description = description;
    this.span = span;
    this.children = children || [];
    this.precedence = 1;
  }

  inspect() {
    let rv = this.description;
    if (this.children.length > 0) {
      rv += "(" + this.children.map(c => c.inspect()).join(", ") + ")";
    }
    rv += "[" + this.span.start + ":" + this.span.end + "]";
    return rv;
  }
}

class PSimpleType extends PType {
  constructor(name, span) {
    super(`type(${name})`, span);
    this.name = name;
  }
}

// used only in compound types: a field name with an optional type and optional default value.
class PTypedField {
  constructor(name, type, defaultValue, span) {
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
    this.span = span;
  }

  inspect() {
    let rv = `field(${this.name}`;
    if (this.type) rv += ": " + this.type.inspect();
    if (this.defaultValue) rv += " = " + this.defaultValue.inspect();
    rv += ")[" + this.span.start + ":" + this.span.end + "]";
    return rv;
  }
}

class PCompoundType extends PType {
  constructor(fields, span) {
    super("compoundType", span, fields);
  }
}

class PTemplateType extends PType {
  constructor(name, params, span) {
    super(`templateType(${name})`, span, params);
    this.name = name;
  }
}

class PParameterType extends PType {
  constructor(name, span) {
    super(`parameterType(${name})`, span);
    this.name = name;
  }
}

class PFunctionType extends PType {
  constructor(argType, resultType, span) {
    super("functionType", span, [ argType, resultType ]);
    this.argType = argType;
    this.resultType = resultType;
    this.precedence = 2;
  }
}

class PDisjointType extends PType {
  constructor(types, span) {
    super("disjointType", span, types);
    this.precedence = 3;
  }
}


// ----- parsers

const simpleType = $.alt("@", $(TYPE_NAME).map(match => match[0])).map((match, span) => {
  return new PSimpleType(match, span);
});

const typedField = $([
  () => reference,
  $.optional([ $.drop(linespace), $.drop(":"), $.drop(linespace), () => typedecl ], ""),
  $.optional([ $.drop(linespace), $.drop("="), $.drop(linespace), () => expression ], "")
]).map(match => {
  if (match[1] == "") match[1] = null;
  if (match[2] == "") match[2] = null;
  const type = match[1] ? match[1][0] : null;
  const defaultValue = match[2] ? match[2][0] : null;
  return new PTypedField(match[0].name, type, defaultValue, match[0].span);
});

export const compoundType = repeatSurrounded(
  "(",
  typedField,
  ",",
  ")",
  linespace,
  "type field"
).map((match, span) => {
  return new PCompoundType(match[0], span);
});

const templateType = $([
  $(TYPE_NAME).map(match => match[0]),
  repeatSurrounded("(", () => typedecl, ",", ")", linespace, "type")
]).map((match, span) => {
  return new PTemplateType(match[0], match[1][0], span);
});

const parameterType = $([ $.drop("$"), $(TYPE_NAME).map(match => match[0]) ]).map((match, span) => {
  return new PParameterType(match[0], span);
});

const nestedType = $([ $.drop("("), () => typedecl, $.drop(")") ]).map(match => match[0]);

const componentType = $.alt(nestedType, parameterType, templateType, simpleType, compoundType);

const functionType = $([
  componentType,
  $.drop(linespace),
  $.commit("->").drop(),
  $.drop(linespace),
  () => typedecl
]).map((match, span) => {
  return new PFunctionType(match[0], match[1], span);
}).or(componentType);

const disjointType  = repeatSeparated(
  functionType,
  $.drop("|"),
  linespace
).map((match, span) => {
  if (match.length == 1) return match[0];
  return new PDisjointType(match, span);
});

export const typedecl = disjointType.named("type");
