"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.func.run(s, options).inspect();
const parseExpr = (s, options) => parser.expression.run(s, options).inspect();
const parseCode = (s, options) => parser.code.run(s, options).inspect();
const parseBlock = (s, options) => parser.codeBlock.run(s, options).inspect();


describe("Parse code", () => {
  describe("function", () => {
    it("empty", () => {
      parse("-> ()").should.eql("function(none -> none)(const(NOTHING)[3:5])[0:2]");
    });

    it("simple expression", () => {
      parse("(x: Int) -> x * 2").should.eql(
        "function(compoundType(field(x: type(Int)[4:7])[1:2])[0:8] -> none)(" +
          "binary(*)(x[12:13], const(NUMBER_BASE10, 2)[16:17])[12:17]" +
        ")[9:11]"
      );
    });

    it("with no arg type", () => {
      parse("(x) -> x * 2").should.eql(
        "function(compoundType(field(x)[1:2])[0:3] -> none)(" +
          "binary(*)(x[7:8], const(NUMBER_BASE10, 2)[11:12])[7:12]" +
        ")[4:6]"
      );
    });

    it("with return type", () => {
      parse("(x: Int): Int -> x").should.eql(
        "function(compoundType(field(x: type(Int)[4:7])[1:2])[0:8] -> type(Int)[10:13])(" +
          "x[17:18]" +
        ")[14:16]"
      );
    });

    it("complex parameters", () => {
      parse("(a: Map(String, Int), b: String -> Int) -> false").should.eql(
        "function(compoundType(" +
          "field(a: templateType(Map)(" +
            "type(String)[8:14], type(Int)[16:19]" +
          ")[4:20])[1:2], " +
          "field(b: functionType(type(String)[25:31], type(Int)[35:38])[25:38])[22:23]" +
        ")[0:39] -> none)(" +
          "const(BOOLEAN, false)[43:48]" +
        ")[40:42]"
      );
    });

    it("default values", () => {
      parse("(x: Int = 4, y: Int = 5) -> x + y").should.eql(
        "function(compoundType(" +
          "field(x: type(Int)[4:7] = const(NUMBER_BASE10, 4)[10:11])[1:2], " +
          "field(y: type(Int)[16:19] = const(NUMBER_BASE10, 5)[22:23])[13:14]" +
        ")[0:24] -> none)(" +
          "binary(+)(x[28:29], y[32:33])[28:33]" +
        ")[25:27]"
      );
    });

    it("nested", () => {
      parse("-> -> 69").should.eql(
        "function(none -> none)(function(none -> none)(const(NUMBER_BASE10, 69)[6:8])[3:5])[0:2]"
      );
    });

    it("via expression", () => {
      parseExpr("-> 3").should.eql(
        "function(none -> none)(const(NUMBER_BASE10, 3)[3:4])[0:2]"
      );
      parseExpr("(x: Int) -> 3").should.eql(
        "function(compoundType(field(x: type(Int)[4:7])[1:2])[0:8] -> none)(const(NUMBER_BASE10, 3)[12:13])[9:11]"
      );
    });
  });

  describe("code", () => {
    it("expression", () => {
      parseCode("x + y").should.eql("binary(+)(x[0:1], y[4:5])[0:5]");
    });

    it("let", () => {
      parseCode("let x = 100").should.eql("locals(let(x[4:5], const(NUMBER_BASE10, 100)[8:11])[4:5])[0:3]");
      (() => parseCode("let return = 1")).should.throw(/Reserved/);
    });

    it("make", () => {
      parseCode("make x := 100").should.eql("locals(make(x[5:6], const(NUMBER_BASE10, 100)[10:13])[5:6])[0:4]");
      (() => parseCode("make return = 1")).should.throw(/Reserved/);
    });

    it("assignment", () => {
      parseCode("count := 9").should.eql("assign(count[0:5], const(NUMBER_BASE10, 9)[9:10])[6:8]");
      parseCode("count := count + 1").should.eql(
        "assign(count[0:5], binary(+)(count[9:14], const(NUMBER_BASE10, 1)[17:18])[9:18])[6:8]"
      );
    });

    it("handler", () => {
      parseCode("on .peek -> 3").should.eql(
        "on(const(SYMBOL, peek)[3:8], const(NUMBER_BASE10, 3)[12:13])[0:2]"
      );
      parseCode("on () -> true").should.eql(
        "on(compoundType[3:5], const(BOOLEAN, true)[9:13])[0:2]"
      );
      parseCode("on (x: Int) -> x * 2").should.eql(
        "on(" +
          "compoundType(field(x: type(Int)[7:10])[4:5])[3:11], " +
          "binary(*)(x[15:16], const(NUMBER_BASE10, 2)[19:20])[15:20]" +
        ")[0:2]"
      );
      (() => parseCode("on 3 -> 3")).should.match(/symbol or parameters/);
    });

    it("return", () => {
      parseCode("return 3").should.eql(
        "return(const(NUMBER_BASE10, 3)[7:8])[0:6]"
      );
    });
  });

  describe("block of code", () => {
    it("empty", () => {
      parseBlock("{}").should.eql("block[0:2]");
      parseBlock("{  }").should.eql("block[0:4]");
    });

    it("separated by ;", () => {
      parseBlock("{ 3; 4 }").should.eql("block(" +
        "const(NUMBER_BASE10, 3)[2:3], " +
        "const(NUMBER_BASE10, 4)[5:6]" +
      ")[0:8]");
    });

    it("separated by linefeed", () => {
      parseBlock("{\n  true\n  false\n}").should.eql("block(" +
        "const(BOOLEAN, true)[4:8], " +
        "const(BOOLEAN, false)[11:16]" +
      ")[0:18]");
    });

//     it "comments", ->
//       parse("{  # code\n# 3\n  true\n  # ok!\n}").should.eql(
//         code: [
//           { boolean: true, comment: "# code\n# 3", pos: [ 16, 20 ] }
//         ]
//         trailingComment: "# ok!"
//         pos: [ 0, 30 ]
//       )
  });
});
