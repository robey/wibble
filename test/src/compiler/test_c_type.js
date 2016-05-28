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
    compileType("String | (x: Int) -> String").inspect().should.eql("String | ((x: Int) -> String)");
  });
});


// describe "TypeDescriptor", ->
//   it "named type equality", ->
//     new t_type.NamedType("House").equals(new t_type.NamedType("House")).should.eql true
//     new t_type.NamedType("House").equals(new t_type.NamedType("Cat")).should.eql false
//
//   it "function type equality", ->
//     f1 = t_type.functionType(descriptors.DInt, descriptors.DSymbol)
//     f2 = t_type.functionType(descriptors.DString, descriptors.DSymbol)
//     f3 = t_type.functionType(descriptors.DInt, descriptors.DSymbol)
//     f1.equals(f2).should.eql false
//     f1.equals(f3).should.eql true
//
//   it "compound type equality", ->
//     xInt = { name: "x", type: descriptors.DInt }
//     nameString = { name: "name", type: descriptors.DString }
//     s1 = new t_type.CompoundType([ xInt, nameString ])
//     s2 = new t_type.CompoundType([ nameString, xInt ])
//     s3 = new t_type.CompoundType([ xInt ])
//     s1.equals(s1).should.eql true
//     s1.equals(s2).should.eql true
//     s1.equals(s3).should.eql false
//     s2.equals(s1).should.eql true
//     s2.equals(s2).should.eql true
//     s2.equals(s3).should.eql false
//     s3.equals(s1).should.eql false
//     s3.equals(s2).should.eql false
//     s3.equals(s3).should.eql true
//
//   it "compound type accessors", ->
//     xInt = { name: "x", type: descriptors.DInt }
//     nameString = { name: "name", type: descriptors.DString }
//     s1 = new t_type.CompoundType([ xInt, nameString ])
//     s1.handlerTypeForMessage(null, "x").should.eql descriptors.DInt
//     s1.handlerTypeForMessage(null, "name").should.eql descriptors.DString
//     s1.handlerTypeForMessage(null, "missing").should.eql descriptors.DAny
//
//   describe "can coerce to other types", ->
//     it "simple", ->
//       descriptors.DString.canCoerceFrom(descriptors.DString).should.eql true
//       descriptors.DInt.canCoerceFrom(descriptors.DSymbol).should.eql false
//       descriptors.DAny.canCoerceFrom(descriptors.DString).should.eql true
//
//     it "structs", ->
//       xInt = { name: "x", type: descriptors.DInt }
//       nameString = { name: "name", type: descriptors.DString }
//       s1 = new t_type.CompoundType([ xInt, nameString ])
//       s2 = new t_type.CompoundType([ nameString, xInt ])
//       s3 = new t_type.CompoundType([ xInt ])
//       new t_type.CompoundType([]).canCoerceFrom(descriptors.DNothing).should.eql true
//       s3.canCoerceFrom(descriptors.DInt).should.eql true
//       s3.canCoerceFrom(s2).should.eql false
//       s1.canCoerceFrom(s2).should.eql true
//       s2.canCoerceFrom(s1).should.eql true
//
//     it "structs with positionals", ->
//       xInt = { name: "x", type: descriptors.DInt }
//       nameString = { name: "name", type: descriptors.DString }
//       s1 = new t_type.CompoundType([ xInt, nameString ])
//       s2 = new t_type.CompoundType([ { name: "?0", type: descriptors.DInt }, { name: "?1", type: descriptors.DString } ])
//       s3 = new t_type.CompoundType([ { name: "?0", type: descriptors.DSymbol }, { name: "?1", type: descriptors.DString } ])
//       s1.canCoerceFrom(s2).should.eql true
//       s1.canCoerceFrom(s3).should.eql false
//
//     it "structs with missing fields", ->
//       s1 = new t_type.CompoundType([
//         { name: "x", type: descriptors.DInt }
//         { name: "name", type: descriptors.DString }
//         { name: "valid", type: descriptors.DBoolean, value: { boolean: true } }
//         { name: "wicket", type: descriptors.DInt }
//       ])
//       s2 = new t_type.CompoundType([
//         { name: "?0", type: descriptors.DInt }
//         { name: "wicket", type: descriptors.DInt }
//         { name: "name", type: descriptors.DString }
//       ])
//       s3 = new t_type.CompoundType([
//         { name: "?0", type: descriptors.DInt }
//         { name: "name", type: descriptors.DString }
//       ])
//       s1.canCoerceFrom(s2).should.eql true
//       s1.canCoerceFrom(s3).should.eql false
//       s3.canCoerceFrom(s2).should.eql false
//
//     it "structs with nothing", ->
//       s1 = new t_type.CompoundType([
//         { name: "height", type: descriptors.DInt, value: { number: "base10", value: "0" } }
//         { name: "width", type: descriptors.DInt, value: { number: "base10", value: "0" } }
//       ])
//       s1.canCoerceFrom(descriptors.DNothing).should.eql true
//
//     it "structs with single values", ->
//       s1 = new t_type.CompoundType([
//         { name: "height", type: descriptors.DInt, value: { number: "base10", value: "0" } }
//         { name: "width", type: descriptors.DInt, value: { number: "base10", value: "0" } }
//       ])
//       s1.canCoerceFrom(descriptors.DInt).should.eql true
//       s1.canCoerceFrom(descriptors.DString).should.eql false
//
//     it "structs with single nested structs", ->
//       dPoint = new t_type.CompoundType([
//         { name: "x", type: descriptors.DInt }
//         { name: "y", type: descriptors.DInt }
//       ])
//       dParam = new t_type.CompoundType([ { name: "point", type: dPoint }])
//       dParam.canCoerceFrom(dPoint).should.eql true
