"use strict";

import $ from "packrattle";
import {
  PCompoundType, PMergedType, PFunctionType, PInlineType, PInlineTypeDeclaration, PParameterType, PSimpleType,
  PTemplateType, PTypedField
} from "../common/ast";
import { commentspace, lf, linespace, repeatSeparated, repeatSurrounded, TYPE_NAME } from "./p_common";
import { symbolRef } from "./p_const";
import { expression, reference } from "./p_expr";

/*
 * parse type declarations.
 */

const simpleType = $.alt("@", $(TYPE_NAME).map(match => match[0])).map((match, span) => {
  return new PSimpleType(match, span);
});

const typedField = $([
  () => reference,
  $.drop(linespace),
  $.drop(":"),
  $.drop(linespace),
  () => typedecl,
  $.optional([ $.drop(linespace), $.drop("="), $.drop(linespace), () => expression ], "")
]).map(match => {
  if (match[2] == "") match[2] = null;
  const defaultValue = match[2] ? match[2][0] : null;
  return new PTypedField(match[0].name, match[1], defaultValue, match[0].span);
});

export const compoundType = repeatSurrounded(
  "(",
  typedField,
  ",",
  ")",
  $.drop(linespace),
  "type field"
).map((match, span) => {
  return new PCompoundType(match[0], span);
});

const templateType = $([
  $(TYPE_NAME).map(match => match[0]),
  repeatSurrounded("(", () => typedecl, ",", ")", $.drop(linespace), "type")
]).map((match, span) => {
  return new PTemplateType(match[0], match[1][0], span);
});

const parameterType = $([ $.drop("$"), $(TYPE_NAME).map(match => match[0]) ]).map((match, span) => {
  return new PParameterType(match[0], span);
});

const nestedType = $([ $.drop("("), () => typedecl, $.drop(")") ]).map(match => match[0]);

const declaration = $([
  $.alt(symbolRef, compoundType),
  $.drop(linespace),
  $.drop("->"),
  $.drop(linespace),
  () => typedecl
]).map((match, span) => {
  return new PInlineTypeDeclaration(match[0], match[1], span);
});

const inlineType = repeatSurrounded(
  "{",
  declaration,
  lf,
  "}",
  commentspace,
  "type declaration"
).map((match, span) => {
  return new PInlineType(match[0], match[1], span);
});

const componentType = $.alt(inlineType, nestedType, parameterType, templateType, simpleType, compoundType);

const functionType = $([
  componentType,
  $.drop(linespace),
  $.commit("->").drop(),
  $.drop(linespace),
  () => typedecl
]).map((match, span) => {
  return new PFunctionType(match[0], match[1], span);
}).or(componentType);

const mergedType  = repeatSeparated(
  functionType,
  $.drop("|"),
  $.drop(linespace)
).map((match, span) => {
  if (match.length == 1) return match[0];
  return new PMergedType(match, span);
});

export const typedecl = mergedType.named("type");
