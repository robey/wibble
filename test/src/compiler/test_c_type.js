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
    const assignmentChecker = new compiler.AssignmentChecker(errors, options.logger);
    const type = compiler.compileType(expr, errors, scope, assignmentChecker);
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

  it("template", () => {
    compileType("Array(Int)").inspect().should.eql("Array(Int)");
    (() => compileType("Array")).should.throw(/requires type parameters/);
    (() => compileType("Array()")).should.throw(/requires 1 type parameters/);
    (() => compileType("Array(String, Int)")).should.throw(/requires 1 type parameters/);
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

  describe("wildcards", () => {
    it("simple", () => {
      compileType("Int").parameters.should.eql([]);
      compileType("$A").parameters.should.eql([]);
      compileType("Array($A)").parameters.map(x => x.inspect()).should.eql([ "$A" ]);
      compileType("(x: Int, y: $C) -> String").inspect().should.eql("(x: Int, y: $C) -> String");
    });

    it("uses the same id for nested wildcard reuse", () => {
      const type = compileType("(x: $A) -> Array($A)");
      type.inspect().should.eql("(x: $A) -> Array($A)");
      type.typeHandlers.length.should.eql(1);

      const first = type.typeHandlers[0];
      first.guard.inspect().should.eql("(x: $A)");
      first.type.inspect().should.eql("Array($A)");
      first.type.parameters[0].inspect().should.eql("$A");
      first.guard.fields[0].type.id.should.eql(first.type.parameters[0].id);
    });
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
