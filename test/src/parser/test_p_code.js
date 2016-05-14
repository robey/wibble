"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.func.run(s, options).inspect();
const parseExpr = (s, options) => parser.expression.run(s, options).inspect();

// should = require 'should'
// util = require 'util'
//
// wibble = "../lib/wibble"
// p_code = require "#{wibble}/parser/p_code"
// p_expr = require "#{wibble}/parser/p_expr"
// test_util = require './test_util'
//
// parseWith = test_util.parseWith
// parseFailedWith = test_util.parseFailedWith
//
describe("Parse code", () => {
  describe("function", () => {
//     parse = (line, options) -> parseWith(p_code.functionx, line, options)
//     parseFailed = (line, options) -> parseFailedWith(p_code.functionx, line, options)
//
    it("empty", () => {
      parse("-> ()").should.eql("Function(none -> none)(const(NOTHING)[3:5])[0:2]");
    });

    it("simple expression", () => {
      parse("(x: Int) -> x * 2").should.eql(
        "Function(CompoundType(Field(x: Type(Int)[4:7])[1:2])[0:8] -> none)(" +
          "binary(*)(x[12:13], const(NUMBER_BASE10, 2)[16:17])[12:17]" +
        ")[9:11]"
      );
    });

    it("with no arg type", () => {
      parse("(x) -> x * 2").should.eql(
        "Function(CompoundType(Field(x)[1:2])[0:3] -> none)(" +
          "binary(*)(x[7:8], const(NUMBER_BASE10, 2)[11:12])[7:12]" +
        ")[4:6]"
      );
    });

    it("with return type", () => {
      parse("(x: Int): Int -> x").should.eql(
        "Function(CompoundType(Field(x: Type(Int)[4:7])[1:2])[0:8] -> Type(Int)[10:13])(" +
          "x[17:18]" +
        ")[14:16]"
      );
    });

    it("complex parameters", () => {
      parse("(a: Map(String, Int), b: String -> Int) -> false").should.eql(
        "Function(CompoundType(" +
          "Field(a: TemplateType(Map)(" +
            "Type(String)[8:14], Type(Int)[16:19]" +
          ")[4:20])[1:2], " +
          "Field(b: FunctionType(Type(String)[25:31], Type(Int)[35:38])[25:38])[22:23]" +
        ")[0:39] -> none)(" +
          "const(BOOLEAN, false)[43:48]" +
        ")[40:42]"
      );
    });

    it("default values", () => {
      parse("(x: Int = 4, y: Int = 5) -> x + y").should.eql(
        "Function(CompoundType(" +
          "Field(x: Type(Int)[4:7] = const(NUMBER_BASE10, 4)[10:11])[1:2], " +
          "Field(y: Type(Int)[16:19] = const(NUMBER_BASE10, 5)[22:23])[13:14]" +
        ")[0:24] -> none)(" +
          "binary(+)(x[28:29], y[32:33])[28:33]" +
        ")[25:27]"
      );
    });

    it("nested", () => {
      parse("-> -> 69").should.eql(
        "Function(none -> none)(Function(none -> none)(const(NUMBER_BASE10, 69)[6:8])[3:5])[0:2]"
      );
    });

    it("via expression", () => {
      parseExpr("-> 3").should.eql(
        "Function(none -> none)(const(NUMBER_BASE10, 3)[3:4])[0:2]"
      );
      parseExpr("(x: Int) -> 3").should.eql(
        "Function(CompoundType(Field(x: Type(Int)[4:7])[1:2])[0:8] -> none)(const(NUMBER_BASE10, 3)[12:13])[9:11]"
      );
    });
  });

//   describe "code", ->
//     parse = (line, options) -> parseWith(p_code.code, line, options)
//     parseFailed = (line, options) -> parseFailedWith(p_code.code, line, options)
//
//     it "expression", ->
//       parse("x + y").should.eql(
//         binary: "+"
//         left: { reference: "x", pos: [ 0, 1 ] }
//         right: { reference: "y", pos: [ 4, 5 ] }
//         pos: [ 0, 5 ]
//       )
//
//     it "local val", ->
//       parse("x = 100").should.eql(
//         local: { name: "x", pos: [ 0, 1 ] }
//         value: { number: "base10", value: "100", pos: [ 4, 7 ] }
//         mutable: false
//         pos: [ 0, 1 ]
//       )
//       parse("mutable count = 3").should.eql(
//         local: { name: "count", pos: [ 8, 13 ] }
//         value: { number: "base10", value: "3", pos: [ 16, 17 ] }
//         mutable: true
//         pos: [ 8, 13 ]
//       )
//
//     it "assignment", ->
//       parse("count := 9").should.eql(
//         assignment: "count"
//         value: { number: "base10", value: "9", pos: [ 9, 10 ] }
//         pos: [ 6, 8 ]
//       )
//       parse("count := count + 1").should.eql(
//         assignment: "count"
//         value:
//           binary: "+"
//           left: { reference: "count", pos: [ 9, 14 ] }
//           right: { number: "base10", value: "1", pos: [ 17, 18 ] }
//           pos: [ 9, 18 ]
//         pos: [ 6, 8 ]
//       )
//
//     it "handler", ->
//       parse("on .peek -> 3").should.eql(
//         on: { symbol: "peek", pos: [ 3, 8 ] }
//         handler: { number: "base10", value: "3", pos: [ 12, 13 ] }
//         pos: [ 0, 2 ]
//       )
//       parse("on () -> true").should.eql(
//         on: { compoundType: [], pos: [ 3, 5 ] }
//         handler: { boolean: true, pos: [ 9, 13 ] }
//         pos: [ 0, 2 ]
//       )
//       parse("on (x: Int) -> x * 2").should.eql(
//         on:
//           compoundType: [
//             { name: "x", type: { typename: "Int", pos: [ 7, 10 ] }, value: undefined, pos: [ 4, 5 ] }
//           ]
//           pos: [ 3, 11 ]
//         handler:
//           binary: "*"
//           left: { reference: "x", pos: [ 15, 16 ] }
//           right: { number: "base10", value: "2", pos: [ 19, 20 ] }
//           pos: [ 15, 20 ]
//         pos: [ 0, 2 ]
//       )
//
//     it "handler error", ->
//       parseFailed("on 3 -> 3").should.match /symbol or parameters/
//
//     it "return", ->
//       parse("return 3").should.eql(
//         returnEarly: { number: "base10", value: "3", pos: [ 7, 8 ] }
//         pos: [ 0, 6 ]
//       )
//
//   describe "block of code", ->
//     parse = (line, options) -> parseWith(p_code.codeBlock, line, options)
//     parseFailed = (line, options) -> parseFailedWith(p_code.codeBlock, line, options)
//
//     it "empty", ->
//       parse("{}").should.eql(code: [], pos: [ 0, 2 ])
//       parse("{  }").should.eql(code: [], pos: [ 0, 4 ])
//
//     it "separated by ;", ->
//       parse("{ 3; 4 }").should.eql(
//         code: [
//           { number: "base10", value: "3", pos: [ 2, 3 ] }
//           { number: "base10", value: "4", pos: [ 5, 6 ] }
//         ]
//         pos: [ 0, 8 ]
//       )
//
//     it "separated by linefeed", ->
//       parse("{\n  true\n  false\n}").should.eql(
//         code: [
//           { boolean: true, pos: [ 4, 8 ] }
//           { boolean: false, pos: [ 11, 16 ] }
//         ]
//         pos: [ 0, 18 ]
//       )
//
//     it "comments", ->
//       parse("{  # code\n# 3\n  true\n  # ok!\n}").should.eql(
//         code: [
//           { boolean: true, comment: "# code\n# 3", pos: [ 16, 20 ] }
//         ]
//         trailingComment: "# ok!"
//         pos: [ 0, 30 ]
//       )
});
