"use strict";

import { Scope } from "./scope";
import { newType } from "./type_descriptor";

const TAnything = newType("Anything");
TAnything.anything = true;
TAnything.canAssignFrom = () => true;

const TNothing = newType("Nothing");
// special hack to prevent anything from being able to assign to Nothing, or vice-versa.
TNothing.nothing = true;

const TBoolean = newType("Boolean");
const TInt = newType("Int");
const TString = newType("String");
const TSymbol = newType("Symbol");

const TArray = newType("Array", [ "$A" ]);

export const builtinTypes = new Scope();
builtinTypes.add(TAnything.name, TAnything);
builtinTypes.add(TArray.name, TArray);
builtinTypes.add(TBoolean.name, TBoolean);
builtinTypes.add(TInt.name, TInt);
builtinTypes.add(TNothing.name, TNothing);
builtinTypes.add(TString.name, TString);
builtinTypes.add(TSymbol.name, TSymbol);


// types are often self-referential, so add handlers after all the names are set.
function addHandlers(type, list) {
  const { typedecl } = require("../parser/p_type");
  const { compileType } = require("./c_type");

  list.forEach(spec => {
    // omfg we can't use String#split because js people didn't know how it works.
    const n = spec.indexOf("::");
    const guardString = spec.slice(0, n).trim();
    const typeString = spec.slice(n + 2).trim();
    const rtype = compileType(typedecl.run(typeString), null, builtinTypes);
    if (guardString[0] == ".") {
      type.addSymbolHandler(guardString.slice(1), rtype);
    } else {
      type.addTypeHandler(compileType(typedecl.run(guardString), null, builtinTypes), rtype);
    }
  });
}

builtinTypes.setInit(() => {
  addHandlers(TBoolean, [
    ".not :: Boolean"
  ]);

  addHandlers(TInt, [
    ".+ :: Int -> Int",
    ".- :: Int -> Int",
    ".* :: Int -> Int",
    "./ :: Int -> Int",
    ".% :: Int -> Int",
    ".negative :: () -> Int",
    ".== :: Int -> Boolean",
    ".!= :: Int -> Boolean",
    ".< :: Int -> Boolean",
    ".> :: Int -> Boolean",
    ".<= :: Int -> Boolean",
    ".>= :: Int -> Boolean",
    ".** :: Int -> Int"
  ]);

  addHandlers(TString, [
    ".size :: Int",
    ".toSymbol :: Symbol"
  ]);

  addHandlers(TSymbol, [
    ".toString :: String"
  ]);

  addHandlers(TArray, [
    ".size :: Int",
    "(n: Int) :: $A"
  ]);
});

// t_type.addHandlers DString, typemap,
//   ".size": "Int"
//   ".==": "String -> Boolean"
//   ".!=": "String -> Boolean"
