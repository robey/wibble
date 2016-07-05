"use strict";

import { compiler, Errors, parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";


describe("compileType", () => {
  const parse = (s, options = {}) => parser.typedecl.run(s, options);
  const compileType = (s, options = {}) => {
    const errors = new Errors();
    const scope = options.scope || compiler.builtinTypes;
    const expr = compiler.simplify(parse(s, options), errors);
    const type = compiler.compileType(expr, errors, scope);
    if (errors.length > 0) {
      const error = new Error(errors.inspect());
      error.errors = errors;
      throw error;
    } else {
      return type;
    }
  };

  it("simple", () => {
    compileType("Int").inspect().should.eql("Int");
  });

  it("compound", () => {
    compileType("(x: Int, y: Int)").inspect().should.eql("(x: Int, y: Int)");
  });

  it("parameter", () => {
    const scope = new compiler.Scope(compiler.builtinTypes);
    scope.add("$A", compiler.builtinTypes.get("String"));
    compileType("$A", { scope }).inspect().should.eql("String");
    compileType("$B", { scope }).inspect().should.eql("$B");
  });

  it("functions", () => {
    compileType("String -> Int").inspect().should.eql("String -> Int");
    compileType("(s: String) -> Int").inspect().should.eql("(s: String) -> Int");
    compileType("() -> Int").inspect().should.eql("() -> Int");
  });

  it("disjoint", () => {
    compileType("String | Symbol").inspect().should.eql("String | Symbol");
    compileType("String | (x: Int, y: Int)").inspect().should.eql("String | (x: Int, y: Int)");
    compileType("String | (x: Int) -> String").inspect().should.eql("String | (x: Int) -> String");
  });

  it("wildcards", () => {
    compileType("Int").wildcards.should.eql([]);
    compileType("$A").wildcards.should.eql([ "$A" ]);
    compileType("$A | Int | $B").wildcards.should.eql([ "$A", "$B" ]);
    compileType("(x: Int, y: $C) -> String").wildcards.should.eql([ "$C" ]);
  });
});


// describe "TypeDescriptor", ->
//
//   it "compound type accessors", ->
//     xInt = { name: "x", type: descriptors.DInt }
//     nameString = { name: "name", type: descriptors.DString }
//     s1 = new t_type.CompoundType([ xInt, nameString ])
//     s1.handlerTypeForMessage(null, "x").should.eql descriptors.DInt
//     s1.handlerTypeForMessage(null, "name").should.eql descriptors.DString
//     s1.handlerTypeForMessage(null, "missing").should.eql descriptors.DAny
//
