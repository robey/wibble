"use strict";

import { Scope } from "./scope";
import { newType } from "./type_descriptor";

const TAnything = newType("Anything");
TAnything.canAssignFrom = () => true;

const TNothing = newType("Nothing");
TNothing.nothing = true;

const TBoolean = newType("Boolean");
const TInt = newType("Int");
const TString = newType("String");
const TSymbol = newType("Symbol");

export const builtinTypes = new Scope();
builtinTypes.add(TAnything.name, TAnything);
builtinTypes.add(TBoolean.name, TBoolean);
builtinTypes.add(TInt.name, TInt);
builtinTypes.add(TNothing.name, TNothing);
builtinTypes.add(TString.name, TString);
builtinTypes.add(TSymbol.name, TSymbol);



// # types are often self-referential, so do them after all the names are set.
//
// t_type.addHandlers DBoolean, typemap,
//   ".not": "Boolean"
//
// t_type.addHandlers DInt, typemap,
//   ".+": "Int -> Int"
//   ".-": "Int -> Int"
//   ".*": "Int -> Int"
//   "./": "Int -> Int"
//   ".%": "Int -> Int"
//   ".<<": "Int -> Int"
//   ".>>": "Int -> Int"
//   ".positive": "() -> Int"
//   ".negative": "() -> Int"
//   ".==": "Int -> Boolean"
//   ".!=": "Int -> Boolean"
//   ".<": "Int -> Boolean"
//   ".>": "Int -> Boolean"
//   ".<=": "Int -> Boolean"
//   ".>=": "Int -> Boolean"
//   ".**": "Int -> Int"
//
// t_type.addHandlers DString, typemap,
//   ".size": "Int"
//   ".==": "String -> Boolean"
//   ".!=": "String -> Boolean"
