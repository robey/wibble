"use strict";

import { Scope } from "./scope";
import { newType } from "./type_descriptor";

const TAnything = newType("Anything");
// DAny.canCoerceFrom = (other) -> true

const TBoolean = newType("Boolean");
const TInt = newType("Int");
const TNothing = newType("Nothing");
const TString = newType("String");
const TSymbol = newType("Symbol");

export const builtinTypes = new Scope();
builtinTypes.add(TAnything.name, TAnything);
builtinTypes.add(TBoolean.name, TBoolean);
builtinTypes.add(TInt.name, TInt);
builtinTypes.add(TNothing.name, TNothing);
builtinTypes.add(TString.name, TString);
builtinTypes.add(TSymbol.name, TSymbol);
