"use strict";

import { compiler, Errors, parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";


describe("AssignmentChecker", () => {
  const type1 = compiler.newType("Type1");
  type1.addSymbolHandler("mercury", compiler.builtinTypes.get("Int"));

  const type2 = compiler.newType("Type2");
  type2.addSymbolHandler("venus", compiler.builtinTypes.get("String"));

  const type3 = compiler.newType("Type3");
  type3.addSymbolHandler("mercury", compiler.builtinTypes.get("Int"));
  type3.addSymbolHandler("jupiter", compiler.builtinTypes.get("Int"));

  const makeChecker = (options = {}) => {
    const errors = new Errors();
    const typeScope = new compiler.Scope();
    return new compiler.AssignmentChecker(errors, options.logger, typeScope);
  };

  const parse = (s, options = {}) => parser.expression.run(s, options);

  it("identical type is assignable", () => {
    const checker = makeChecker();
    checker.canAssignFrom(type1, type1).should.eql(true);
    checker.canAssignFrom(type2, type2).should.eql(true);
    checker.canAssignFrom(type1, type2).should.eql(false);
  });

  it("Nothing", () => {
    const checker = makeChecker();
    const Nothing = compiler.builtinTypes.get("Nothing");
    checker.canAssignFrom(Nothing, type1).should.eql(false);
    checker.canAssignFrom(type1, Nothing).should.eql(false);
    checker.canAssignFrom(Nothing, compiler.newType()).should.eql(false);
    checker.canAssignFrom(compiler.newType(), Nothing).should.eql(false);
  });

  it("Anything", () => {
    const checker = makeChecker();
    const Anything = compiler.builtinTypes.get("Anything");
    checker.canAssignFrom(Anything, type1).should.eql(true);
    checker.canAssignFrom(type1, Anything).should.eql(false);
    checker.canAssignFrom(Anything, type3).should.eql(true);
  });

  it("matches compatible signatures", () => {
    const checker = makeChecker();
    checker.canAssignFrom(type1, type3).should.eql(true);
    checker.canAssignFrom(type3, type1).should.eql(false);
  });

  it("matches builtin types", () => {
    const checker = makeChecker();
    checker.canAssignFrom(compiler.builtinTypes.get("String"), compiler.builtinTypes.get("String")).should.eql(true);
    checker.canAssignFrom(compiler.builtinTypes.get("Int"), compiler.builtinTypes.get("Symbol")).should.eql(false);
    checker.canAssignFrom(compiler.builtinTypes.get("Anything"), compiler.builtinTypes.get("String")).should.eql(true);
  });

  it("compound types", () => {
    const xInt = new compiler.CTypedField("x", compiler.builtinTypes.get("Int"));
    const nameString = new compiler.CTypedField("name", compiler.builtinTypes.get("String"));
    const checker = makeChecker();

    const s1 = compiler.newCompoundType([ xInt, nameString ]);
    const s2 = compiler.newCompoundType([ nameString, xInt ]);
    const s3 = compiler.newCompoundType([ xInt ]);
    checker.canAssignFrom(s1, s1).should.eql(true);
    checker.canAssignFrom(s1, s2).should.eql(true);
    checker.canAssignFrom(s1, s3).should.eql(false);
    checker.canAssignFrom(s2, s1).should.eql(true);
    checker.canAssignFrom(s2, s2).should.eql(true);
    checker.canAssignFrom(s2, s3).should.eql(false);
    checker.canAssignFrom(s3, s1).should.eql(false);
    checker.canAssignFrom(s3, s2).should.eql(false);
    checker.canAssignFrom(s3, s3).should.eql(true);
  });

  it("compound type nested", () => {
    const xInt = new compiler.CTypedField("x", compiler.builtinTypes.get("Int"));
    const s3 = compiler.newCompoundType([ xInt ]);
    const checker = makeChecker();
    checker.canAssignFrom(s3, compiler.builtinTypes.get("Int")).should.eql(true);
  });

  it("compound types with positionals", () => {
    const xInt = new compiler.CTypedField("x", compiler.builtinTypes.get("Int"));
    const nameString = new compiler.CTypedField("name", compiler.builtinTypes.get("String"));
    const int0 = new compiler.CTypedField("?0", compiler.builtinTypes.get("Int"));
    const string1 = new compiler.CTypedField("?1", compiler.builtinTypes.get("String"));
    const symbol0 = new compiler.CTypedField("?0", compiler.builtinTypes.get("Symbol"));
    const checker = makeChecker();

    const s1 = compiler.newCompoundType([ xInt, nameString ]);
    const s2 = compiler.newCompoundType([ int0, string1 ]);
    const s3 = compiler.newCompoundType([ symbol0, string1 ]);
    checker.canAssignFrom(s1, s2).should.eql(true);
    checker.canAssignFrom(s1, s3).should.eql(false);
  });

  describe("compound types with default value", () => {
    const s1 = compiler.newCompoundType([
      new compiler.CTypedField("x", compiler.builtinTypes.get("Int")),
      new compiler.CTypedField("name", compiler.builtinTypes.get("String")),
      new compiler.CTypedField("valid", compiler.builtinTypes.get("Boolean"), parse("true")),
      new compiler.CTypedField("wicket", compiler.builtinTypes.get("Int"))
    ]);
    const s2 = compiler.newCompoundType([
      new compiler.CTypedField("?0", compiler.builtinTypes.get("Int")),
      new compiler.CTypedField("wicket", compiler.builtinTypes.get("Int")),
      new compiler.CTypedField("name", compiler.builtinTypes.get("String"))
    ]);
    const s3 = compiler.newCompoundType([
      new compiler.CTypedField("?0", compiler.builtinTypes.get("Int")),
      new compiler.CTypedField("name", compiler.builtinTypes.get("String"))
    ]);
    const s4 = compiler.newCompoundType([
      new compiler.CTypedField("height", compiler.builtinTypes.get("Int"), parse("0")),
      new compiler.CTypedField("width", compiler.builtinTypes.get("Int"), parse("0"))
    ]);
    const dPoint = new compiler.newCompoundType([
      new compiler.CTypedField("x", compiler.builtinTypes.get("Int")),
      new compiler.CTypedField("y", compiler.builtinTypes.get("Int"))
    ]);
    const s5 = compiler.newCompoundType([
      new compiler.CTypedField("point", dPoint)
    ]);
    const checker = makeChecker();

    it("nothing", () => {
      checker.canAssignFrom(s4, compiler.builtinTypes.get("Nothing")).should.eql(true);
    });

    it("single value", () => {
      checker.canAssignFrom(s4, compiler.builtinTypes.get("Int")).should.eql(true);
      checker.canAssignFrom(s4, compiler.builtinTypes.get("String")).should.eql(false);
    });

    it("other compound types", () => {
      checker.canAssignFrom(s1, s2).should.eql(true);
      checker.canAssignFrom(s1, s3).should.eql(false);
      checker.canAssignFrom(s3, s2).should.eql(false);
    });

    it("nested", () => {
      checker.canAssignFrom(s5, dPoint).should.eql(true);
    });
  });

  describe("wildcard type", () => {
    const s1 = compiler.newWildcard("$A");
    const s2 = compiler.newWildcard("$B");
    const s3 = compiler.newWildcard("$C");

    it("gets added to the wildcard map", () => {
      const checker = makeChecker();
      checker.canAssignFrom(compiler.builtinTypes.get("Int"), s1).should.eql(false);
      checker.typeScope.keys.should.eql([]);
      checker.canAssignFrom(s1, compiler.builtinTypes.get("Int")).should.eql(true);
      checker.typeScope.keys.should.eql([ s1.name ]);
    });

    it("can match itself", () => {
      const checker = makeChecker();
      checker.canAssignFrom(s1, s1).should.eql(true);
      checker.canAssignFrom(s2, s2).should.eql(true);
      checker.canAssignFrom(s1, s2).should.eql(true);
      checker.canAssignFrom(s2, s3).should.eql(true);
      checker.typeScope.keys.should.eql([ s1.name, s2.name ]);
      checker.canAssignFrom(s2, s1).should.eql(true);
    });

    it("resolves in reverse after wildcard matching", () => {
      const checker = makeChecker();
      checker.canAssignFrom(s1, compiler.builtinTypes.get("Int")).should.eql(true);
      checker.canAssignFrom(compiler.builtinTypes.get("Int"), s1).should.eql(true);
    });
  });

  describe("sum type", () => {
    const checker = makeChecker();
    const s1 = compiler.mergeTypes([ compiler.builtinTypes.get("Int"), compiler.builtinTypes.get("String") ], checker);
    const s2 = compiler.mergeTypes([ s1, compiler.builtinTypes.get("Symbol") ], checker);
    const s3 = compiler.mergeTypes([ s2, compiler.builtinTypes.get("Int") ], checker);

    const game = compiler.newType("Game");
    game.addSymbolHandler("hungry", compiler.builtinTypes.get("Boolean"));
    const trap = compiler.newType("Trap");
    trap.addSymbolHandler("hungry", compiler.builtinTypes.get("Boolean"));
    trap.addSymbolHandler("full", compiler.builtinTypes.get("Boolean"));
    const cat = compiler.newType("Cat");
    cat.addSymbolHandler("play", compiler.builtinTypes.get("Nothing"));
    cat.addSymbolHandler("hungry", compiler.builtinTypes.get("Boolean"));

    it("right side", () => {
      checker.canAssignFrom(compiler.builtinTypes.get("Int"), s1).should.eql(false);
      checker.canAssignFrom(s2, s1).should.eql(true);
      checker.canAssignFrom(s3, s1).should.eql(true);
      checker.canAssignFrom(s1, s2).should.eql(false);
      checker.canAssignFrom(game, compiler.mergeTypes([ trap, cat ], checker)).should.eql(true);
    });

    it("left side", () => {
      s1.inspect().should.eql("Int | String");
      s2.inspect().should.eql("Int | String | Symbol");
      s3.inspect().should.eql("Int | String | Symbol");

      checker.canAssignFrom(s1, compiler.builtinTypes.get("Int")).should.eql(true);
      checker.canAssignFrom(s1, compiler.builtinTypes.get("String")).should.eql(true);
      checker.canAssignFrom(s2, compiler.builtinTypes.get("Int")).should.eql(true);
      checker.canAssignFrom(compiler.mergeTypes([ trap, cat ], checker), game).should.eql(false);
      checker.canAssignFrom(compiler.mergeTypes([ trap, cat ], checker), cat).should.eql(true);
    });
  });
});
