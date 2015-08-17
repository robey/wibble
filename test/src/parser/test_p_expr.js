"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.expression.run(s, options).inspect();

describe("Parse expressions", () => {
  it("reference", () => {
    parse("x").should.eql("x[0:1]");
    parse("hello").should.eql("hello[0:5]");
  });

  describe("array", () => {
    it("empty", () => {
      parse("[]").should.eql("array[0:2]");
      parse("[  ]").should.eql("array[0:4]");
    });

    it("single", () => {
      parse("[ 3 ]").should.eql("array(const(NUMBER_BASE10, 3)[2:3])[0:5]");
    });

    it("multiple", () => {
      parse("[ true, true, false ]").should.eql("array(" +
        "const(BOOLEAN, true)[2:6], " +
        "const(BOOLEAN, true)[8:12], " +
        "const(BOOLEAN, false)[14:19]" +
      ")[0:21]");
    });

    it("trailing comma", () => {
      parse("[9,]").should.eql("array(const(NUMBER_BASE10, 9)[1:2])[0:4]");
    });

    it("nested", () => {
      parse("[ [true], [false] ]").should.eql("array(" +
        "array(const(BOOLEAN, true)[3:7])[2:8], " +
        "array(const(BOOLEAN, false)[11:16])[10:17]" +
      ")[0:19]");
    });

    it("multi-line", () => {
      parse("[\n  true,\n  false\n]").should.eql("array(" +
        "const(BOOLEAN, true)[4:8], " +
        "const(BOOLEAN, false)[12:17]" +
      ")[0:19]");
    });

    it("with comment", () => {
      parse("[\n  # true\n  true\n]").should.eql("array(const(BOOLEAN, true)#\"# true\"[13:17])[0:19]");
      parse("[\n  true\n  # more later\n]").should.eql("array(const(BOOLEAN, true)[4:8])##\"# more later\"[0:25]");
    });

    it("failing", () => {
      (() => parse("[ ??? ]")).should.throw(/Expected array/);
    });
  });

  describe("struct", () => {
    it("without names", () => {
      parse("(x, y)").should.eql("struct(field(x[1:2])[1:2], field(y[4:5])[4:5])[0:6]");
    });

    it("with names", () => {
      parse("(  x=3,y = 4)").should.eql("struct(" +
        "field(x)(const(NUMBER_BASE10, 3)[5:6])[3:6], " +
        "field(y)(const(NUMBER_BASE10, 4)[11:12])[7:12]" +
      ")[0:13]");
    });

    it("single-valued", () => {
      parse("(true)").should.eql("const(BOOLEAN, true)[1:5]");
    });

    it("failing", () => {
      (() => parse("(???)")).should.throw(/Expected struct member/);
      (() => parse("(x = ???)")).should.throw(/Expected struct member/);
    });
  });

  it("unary", () => {
    parse("not true").should.eql("unary(not)(const(BOOLEAN, true)[4:8])[0:8]");
    parse("-  5").should.eql("unary(-)(const(NUMBER_BASE10, 5)[3:4])[0:4]");
    parse("+a").should.eql("unary(+)(a[1:2])[0:2]");
    parse("not not true").should.eql("unary(not)(unary(not)(const(BOOLEAN, true)[8:12])[4:12])[0:12]");
  });

  describe("call", () => {
    it("simple", () => {
      parse("a b").should.eql("call(a[0:1], b[2:3])[0:3]");
      parse("3 .+").should.eql("call(const(NUMBER_BASE10, 3)[0:1], const(SYMBOL, +)[2:4])[0:4]");
    });

    it("compound", () => {
      parse("widget.draw()").should.eql("call(" +
        "call(widget[0:6], const(SYMBOL, draw)[6:11])[0:11], " +
        "const(NOTHING)[11:13]" +
      ")[0:13]");
      parse("widget .height .subtract 3").should.eql("call(" +
        "call(" +
          "call(widget[0:6], const(SYMBOL, height)[7:14])[0:14], " +
          "const(SYMBOL, subtract)[15:24]" +
        ")[0:24], " +
        "const(NUMBER_BASE10, 3)[25:26]" +
      ")[0:26]");
    });

    it("with struct", () => {
      parse("b.add(4, 5)").should.eql("call(" +
        "call(b[0:1], const(SYMBOL, add)[1:5])[0:5], " +
        "struct(field(const(NUMBER_BASE10, 4)[6:7])[6:7], field(const(NUMBER_BASE10, 5)[9:10])[9:10])[5:11]" +
      ")[0:11]");
    });

    it("multi-line", () => {
      parse("a .b \\\n  .c").should.eql("call(" +
        "call(a[0:1], const(SYMBOL, b)[2:4])[0:4], " +
        "const(SYMBOL, c)[9:11]" +
      ")[0:11]");
    });
  });

  describe("binary", () => {
    it("**", () => {
      parse("2 ** 3 ** 4").should.eql("binary(**)(" +
        "binary(**)(const(NUMBER_BASE10, 2)[0:1], const(NUMBER_BASE10, 3)[5:6])[0:6], " +
        "const(NUMBER_BASE10, 4)[10:11]" +
      ")[0:11]");
    });

    it("* / %", () => {
      parse("a * b / c % d").should.eql("binary(%)(" +
        "binary(/)(" +
          "binary(*)(a[0:1], b[4:5])[0:5], " +
          "c[8:9]" +
        ")[0:9], " +
        "d[12:13]" +
      ")[0:13]");
    });

    it("+ -", () => {
      parse("a + b - c").should.eql("binary(-)(" +
        "binary(+)(a[0:1], b[4:5])[0:5], " +
        "c[8:9]" +
      ")[0:9]");
    });

    it("* vs + precedence", () => {
      parse("a + b * c + d").should.eql("binary(+)(" +
        "binary(+)(a[0:1], binary(*)(b[4:5], c[8:9])[4:9])[0:9], " +
        "d[12:13]" +
      ")[0:13]");
    });

    it("+, ==, and precedence", () => {
      parse("a and b + c == d").should.eql("binary(and)(" +
        "a[0:1], " +
        "binary(==)(binary(+)(b[6:7], c[10:11])[6:11], d[15:16])[6:16]" +
      ")[0:16]");
    });

    it("can span multiple lines", () => {
      parse("3 + \\\n 4").should.eql("binary(+)(" +
        "const(NUMBER_BASE10, 3)[0:1], " +
        "const(NUMBER_BASE10, 4)[7:8]" +
      ")[0:8]");
    });

    it("notices a missing argument", () => {
      (() => parse("3 +")).should.throw(/Expected operand/);
      (() => parse("3 + 6 *")).should.throw(/Expected operand/);
    });
  });

  describe("if", () => {
    it("if _ then _", () => {
      parse("if x < 0 then x").should.eql("if(" +
        "binary(<)(x[3:4], const(NUMBER_BASE10, 0)[7:8])[3:8], " +
        "x[14:15]" +
      ")[0:2]");
    });

    it("if _ then _ else _", () => {
      parse("if x < 0 then -x else x").should.eql("if(" +
        "binary(<)(x[3:4], const(NUMBER_BASE10, 0)[7:8])[3:8], " +
        "unary(-)(x[15:16])[14:16], " +
        "x[22:23]" +
      ")[0:2]");
    });

    it("if {block} then _ else _", () => {
      parse("if { 3; true } then 1 else 2").should.eql("if(" +
        "code??, " +
        "const(NUMBER_BASE10, 1)[20:21], " +
        "const(NUMBER_BASE10, 2)[27:28]" +
      ")[0:2]");
    });
      //   condition:
      //     code: [
      //       { number: "base10", value: "3", pos: [ 5, 6 ] }
      //       { boolean: true, pos: [ 8, 12 ] }
      //     ]
      //     pos: [ 3, 14 ]
      //   ifThen: { number: "base10", value: "1", pos: [ 20, 21 ] }
      //   ifElse: { number: "base10", value: "2", pos: [ 27, 28 ] }
      //   pos: [ 0, 2 ]
      // )

    it("nested", () => {
      parse("if a then (if b then 3) else 9").should.eql("if(" +
        "a[3:4], " +
        "if(b[14:15], const(NUMBER_BASE10, 3)[21:22])[11:13], " +
        "const(NUMBER_BASE10, 9)[29:30]" +
      ")[0:2]");
    });
    
    it("failing", () => {
      (() => parse("if ???")).should.throw(/Expected expression/);
      (() => parse("if 3 then ???")).should.throw(/Expected expression/);
      (() => parse("if 3 then 3 else ???")).should.throw(/Expected expression/);
    });
  });

//   describe "unless", ->
//     it "_ unless _", ->
//       parse("9 unless x > 3").should.eql(
//         unless:
//           binary: ">"
//           left: { reference: "x", pos: [ 9, 10 ] }
//           right: { number: "base10", value: "3", pos: [ 13, 14 ] }
//           pos: [ 9, 14 ]
//         nested: { number: "base10", value: "9", pos: [ 0, 1 ] }
//         pos: [ 2, 8 ]
//       )
//
//     it "complex expression unless _", ->
//       parse("x .drop 9 unless y").should.eql(
//         unless: { reference: "y", pos: [ 17, 18 ] }
//         nested:
//           call:
//             call: { reference: "x", pos: [ 0, 1 ] }
//             arg: { symbol: "drop", pos: [ 2, 7 ] }
//             pos: [ 0, 7 ]
//           arg: { number: "base10", value: "9", pos: [ 8, 9 ] }
//           pos: [ 0, 9 ]
//         pos: [ 10, 16 ]
//       )
//
//   describe "new", ->
//     it "simple", ->
//       parse("new { true }").should.eql(
//         newObject:
//           code: [
//             { boolean: true, pos: [ 6, 10 ] }
//           ]
//           pos: [ 4, 12 ]
//         pos: [ 0, 3 ]
//       )
//
//     it "part of a call", ->
//       parse("new { on .foo -> 3 } .foo").should.eql(
//         call:
//           newObject:
//             code: [
//               {
//                 on: { symbol: "foo", pos: [ 9, 13 ] }
//                 handler: { number: "base10", value: "3", pos: [ 17, 18 ] }
//                 pos: [ 6, 8 ]
//               }
//             ]
//             pos: [ 4, 20 ]
//           pos: [ 0, 3 ]
//         arg: { symbol: "foo", pos: [ 21, 25 ] }
//         pos: [ 0, 25 ]
//       )

});
