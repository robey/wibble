"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.expression.run(s, options).inspect();
const parseFunc = (s, options) => parser.func.run(s, options).inspect();

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

  describe("function", () => {
    it("empty", () => {
      parseFunc("-> ()").should.eql("function(compoundType, const(NOTHING)[3:5])[0:2]");
    });

    it("simple expression", () => {
      parseFunc("(x: Int) -> x * 2").should.eql(
        "function(" +
          "compoundType(field(x)(type(Int)[4:7])[1:2])[0:8], " +
          "binary(*)(x[12:13], const(NUMBER_BASE10, 2)[16:17])[12:17]" +
        ")[9:11]"
      );
    });

    it("with return type", () => {
      parseFunc("(x: Int): Int -> x").should.eql(
        "function(" +
          "compoundType(field(x)(type(Int)[4:7])[1:2])[0:8], " +
          "x[17:18], " +
          "type(Int)[10:13]" +
        ")[14:16]"
      );
    });

    it("complex parameters", () => {
      parseFunc("(a: Map(String, Int), b: String -> Int) -> false").should.eql(
        "function(" +
          "compoundType(" +
            "field(a)(templateType(Map)(" +
              "type(String)[8:14], type(Int)[16:19]" +
            ")[4:20])[1:2], " +
            "field(b)(functionType(type(String)[25:31], type(Int)[35:38])[25:38])[22:23]" +
          ")[0:39], " +
          "const(BOOLEAN, false)[43:48]" +
        ")[40:42]"
      );
    });

    it("default values", () => {
      parseFunc("(x: Int = 4, y: Int = 5) -> x + y").should.eql(
        "function(" +
          "compoundType(" +
            "field(x)(type(Int)[4:7], const(NUMBER_BASE10, 4)[10:11])[1:2], " +
            "field(y)(type(Int)[16:19], const(NUMBER_BASE10, 5)[22:23])[13:14]" +
          ")[0:24], " +
          "binary(+)(x[28:29], y[32:33])[28:33]" +
        ")[25:27]"
      );
    });

    it("nested", () => {
      parseFunc("-> -> 69").should.eql(
        "function(compoundType, function(compoundType, const(NUMBER_BASE10, 69)[6:8])[3:5])[0:2]"
      );
    });

    it("via expression", () => {
      parse("-> 3").should.eql(
        "function(compoundType, const(NUMBER_BASE10, 3)[3:4])[0:2]"
      );
      parse("(x: Int) -> 3").should.eql(
        "function(compoundType(field(x)(type(Int)[4:7])[1:2])[0:8], const(NUMBER_BASE10, 3)[12:13])[9:11]"
      );
      parse("(x: Int) -> x * 2").should.eql(
        "function(compoundType(field(x)(type(Int)[4:7])[1:2])[0:8], " +
          "binary(*)(x[12:13], const(NUMBER_BASE10, 2)[16:17])[12:17]" +
        ")[9:11]"
      );
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

  describe("new", () => {
    it("simple", () => {
      parse("new { true }").should.eql(
        "new(block(const(BOOLEAN, true)[6:10])[4:12])[0:3]"
      );
    });

    it("part of a call", () => {
      parse("new { on .foo -> 3 } .foo").should.eql(
        "call(" +
          "new(block(on(const(SYMBOL, foo)[9:13], const(NUMBER_BASE10, 3)[17:18])[6:8])[4:20])[0:3], " +
          "const(SYMBOL, foo)[21:25]" +
        ")[0:25]"
      );
    });

    it("explicit type", () => {
      parse("new List(Int) { true }").should.eql(
        "new(block(const(BOOLEAN, true)[16:20])[14:22], templateType(List)(type(Int)[9:12])[4:13])[0:3]"
      );
    });
  });

  it("unary", () => {
    parse("not true").should.eql("unary(not)(const(BOOLEAN, true)[4:8])[0:8]");
    parse("-  5").should.eql("unary(-)(const(NUMBER_BASE10, 5)[3:4])[0:4]");
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

    it("and, or", () => {
      parse("true or 3 == 1 and false").should.eql(
        "binary(or)(" +
          "const(BOOLEAN, true)[0:4], " +
          "binary(and)(" +
            "binary(==)(const(NUMBER_BASE10, 3)[8:9], const(NUMBER_BASE10, 1)[13:14])[8:14], " +
            "const(BOOLEAN, false)[19:24]" +
          ")[8:24]" +
        ")[0:24]"
      );
    });

    it("can span multiple lines", () => {
      parse("3 + \n  4").should.eql("binary(+)(" +
        "const(NUMBER_BASE10, 3)[0:1], " +
        "const(NUMBER_BASE10, 4)[7:8]" +
      ")[0:8]");
    });

    it("with comment", () => {
      parse("3 + # add numbers\n  4").should.eql("binary(+)(" +
        "const(NUMBER_BASE10, 3)[0:1], " +
        "const(NUMBER_BASE10, 4)[20:21]" +
      ")#\"# add numbers\"[0:21]");
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
        "block(" +
          "const(NUMBER_BASE10, 3)[5:6], " +
          "const(BOOLEAN, true)[8:12]" +
        ")[3:14], " +
        "const(NUMBER_BASE10, 1)[20:21], " +
        "const(NUMBER_BASE10, 2)[27:28]" +
      ")[0:2]");
    });

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
      (() => parse("if 3 then 3 else ???")).should.throw(/Expected else/);
    });
  });

  it("repeat", () => {
    parse("repeat 3").should.eql("repeat(const(NUMBER_BASE10, 3)[7:8])[0:6]");
    parse("repeat { if true then break }").should.eql(
      "repeat(block(if(const(BOOLEAN, true)[12:16], break[22:27])[9:11])[7:29])[0:6]"
    );
  });

  it("while", () => {
    parse("while true do false").should.eql("while(const(BOOLEAN, true)[6:10], const(BOOLEAN, false)[14:19])[0:5]");
  });
});
