import { EngineOptions, Token } from "packrattle";
import { parser } from "../../wibble";
import { makeDot, saveParser } from "./helpers";

import "should";
import "source-map-support/register";

const parse = (s: string, options: EngineOptions = {}) => {
  return parser.expression.run(parser.tokenizer.parser.run(s), options);
};

const parseFunc = (s: string, options: EngineOptions = {}) => {
  return parser.func.run(parser.tokenizer.parser.run(s), options);
};

describe("Parse expressions", () => {
  it("reference", () => {
    parse("x").inspect().should.eql("x[0...1]");
    parse("hello").inspect().should.eql("hello[0...5]");
    (() => parse("else")).should.throw(/Reserved/);
    (() => parse("Int")).should.throw(/lowercase/);
  });

  describe("array", () => {
    it("empty", () => {
      parse("[]").inspect().should.eql("array[0...2]");
      parse("[  ]").inspect().should.eql("array[0...4]");
    });

    it("single", () => {
      parse("[ 3 ]").inspect().should.eql("array{ const(NUMBER_BASE10, 3)[2...3] }[0...5]");
    });

    it("multiple", () => {
      parse("[ true, true, false ]").inspect().should.eql("array{ " +
        "const(BOOLEAN, true)[2...6], " +
        "const(BOOLEAN, true)[8...12], " +
        "const(BOOLEAN, false)[14...19]" +
      " }[0...21]");
    });

    it("trailing comma", () => {
      parse("[9,]").inspect().should.eql("array{ const(NUMBER_BASE10, 9)[1...2] }[0...4]");
    });

    it("nested", () => {
      parse("[ [true], [false] ]").inspect().should.eql("array{ " +
        "array{ const(BOOLEAN, true)[3...7] }[2...8], " +
        "array{ const(BOOLEAN, false)[11...16] }[10...17]" +
      " }[0...19]");
    });

    it("multi-line", () => {
      parse("[\n  true,\n  false\n]").inspect().should.eql("array{ " +
        "const(BOOLEAN, true)[4...8], " +
        "const(BOOLEAN, false)[12...17]" +
      " }[0...19]");
    });

    it("with comment", () => {
      let ast = parse("[\n  # true\n  true\n]");
      ast.inspect().should.eql("array{ const(BOOLEAN, true)[13...17] }[0...19]");
      ast.source.should.eql("[\n  # true\n  true\n]");
      ast = parse("[\n  true\n  # more later\n]");
      ast.inspect().should.eql("array{ const(BOOLEAN, true)[4...8] }[0...25]");
      ast.source.should.eql("[\n  true\n  # more later\n]");
    });

    it("failing", () => {
      (() => parse("[ ??? ]")).should.throw(/Expected expression/);
    });
  });

  describe("function", () => {
    it("empty", () => {
      parseFunc("-> ()").inspect().should.eql("function{ const(NOTHING, ())[3...5] }[0...5]");
      parseFunc("-> ()").source.should.eql("-> ()");
    });

    it("simple expression", () => {
      const p1 = parseFunc("(x: Int) -> x * 2");
      p1.inspect().should.eql(
        "function{ " +
          "compoundType{ field(x){ type(Int)[4...7] }[1...7] }[0...8], " +
          "binary(*){ x[12...13], const(NUMBER_BASE10, 2)[16...17] }[12...17]" +
        " }[0...17]"
      );
      p1.source.should.eql("(x: Int) -> x * 2");
    });

    it("with return type", () => {
      const p1 = parseFunc("(x: Int): Int -> x");
      p1.inspect().should.eql(
        "function{ " +
          "compoundType{ field(x){ type(Int)[4...7] }[1...7] }[0...8], " +
          "type(Int)[10...13], " +
          "x[17...18]" +
        " }[0...18]"
      );
      p1.source.should.eql("(x: Int): Int -> x");
    });

    it("complex parameters", () => {
      const p1 = parseFunc("(a: Map(String, Int), b: String -> Int) -> false");
      p1.inspect().should.eql(
        "function{ " +
          "compoundType{ " +
            "field(a){ templateType(Map){ " +
              "type(String)[8...14], type(Int)[16...19]" +
            " }[4...20] }[1...20], " +
            "field(b){ functionType{ type(String)[25...31], type(Int)[35...38] }[25...38] }[22...38]" +
          " }[0...39], " +
          "const(BOOLEAN, false)[43...48]" +
        " }[0...48]"
      );
      p1.source.should.eql("(a: Map(String, Int), b: String -> Int) -> false");
    });

    it("default values", () => {
      const p1 = parseFunc("(x: Int = 4, y: Int = 5) -> x + y");
      p1.inspect().should.eql(
        "function{ " +
          "compoundType{ " +
            "field(x){ type(Int)[4...7], const(NUMBER_BASE10, 4)[10...11] }[1...11], " +
            "field(y){ type(Int)[16...19], const(NUMBER_BASE10, 5)[22...23] }[13...23]" +
          " }[0...24], " +
          "binary(+){ x[28...29], y[32...33] }[28...33]" +
        " }[0...33]"
      );
      p1.source.should.eql("(x: Int = 4, y: Int = 5) -> x + y");
    });

    it("nested", () => {
      const p1 = parseFunc("-> -> 69");
      p1.inspect().should.eql(
        "function{ function{ const(NUMBER_BASE10, 69)[6...8] }[3...8] }[0...8]"
      );
      p1.source.should.eql("-> -> 69");
    });

    it("via expression", () => {
      const p1 = parse("-> 3");
      p1.inspect().should.eql(
        "function{ const(NUMBER_BASE10, 3)[3...4] }[0...4]"
      );
      p1.source.should.eql("-> 3");
      const p2 = parse("(x: Int) -> 3");
      p2.inspect().should.eql(
        "function{ " +
          "compoundType{ field(x){ type(Int)[4...7] }[1...7] }[0...8], " +
          "const(NUMBER_BASE10, 3)[12...13]" +
        " }[0...13]"
      );
      p2.source.should.eql("(x: Int) -> 3");
      const p3 = parse("(x: Int) -> x * 2");
      p3.inspect().should.eql(
        "function{ " +
          "compoundType{ field(x){ type(Int)[4...7] }[1...7] }[0...8], " +
          "binary(*){ x[12...13], const(NUMBER_BASE10, 2)[16...17] }[12...17]" +
        " }[0...17]"
      );
      p3.source.should.eql("(x: Int) -> x * 2");
    });
  });

  describe("struct", () => {
    it("without names", () => {
      const p1 = parse("(x, y)");
      p1.inspect().should.eql("struct{ field{ x[1...2] }[1...2], field{ y[4...5] }[4...5] }[0...6]");
      p1.source.should.eql("(x, y)");
    });

    it("with names", () => {
      const p1 = parse("(  x=3,y = 4)");
      p1.inspect().should.eql("struct{ " +
        "field(x){ const(NUMBER_BASE10, 3)[5...6] }[3...6], " +
        "field(y){ const(NUMBER_BASE10, 4)[11...12] }[7...12]" +
      " }[0...13]");
      p1.source.should.eql("(  x=3,y = 4)");
    });

    it("single-valued", () => {
      parse("(true)").inspect().should.eql("nested{ const(BOOLEAN, true)[1...5] }[0...6]");
    });

    it("failing", () => {
      (() => parse("(???)")).should.throw(/Expected expression/);
      (() => parse("(x = ???)")).should.throw(/Expected expression/);
    });
  });

  describe("new", () => {
    it("simple", () => {
      const p1 = parse("new { true }");
      p1.inspect().should.eql(
        "new{ block{ const(BOOLEAN, true)[6...10] }[4...12] }[0...12]"
      );
      p1.source.should.eql("new { true }");
    });

    it("part of a call", () => {
      const p1 = parse("new { on .foo -> 3 } .foo");
      p1.inspect().should.eql(
        "call{ " +
          "new{ " +
            "block{ on{ const(SYMBOL, foo)[9...13], const(NUMBER_BASE10, 3)[17...18] }[6...18] }[4...20]" +
          " }[0...20], " +
          "const(SYMBOL, foo)[21...25]" +
        " }[0...25]"
      );
      p1.source.should.eql("new { on .foo -> 3 } .foo");
    });

    it("explicit type", () => {
      const p1 = parse("new List(Int) { true }");
      p1.inspect().should.eql(
        "new{ " +
          "templateType(List){ type(Int)[9...12] }[4...13], " +
          "block{ const(BOOLEAN, true)[16...20] }[14...22]" +
        " }[0...22]"
      );
      p1.source.should.eql("new List(Int) { true }");
    });
  });

  it("unary", () => {
    const p1 = parse("not true");
    p1.inspect().should.eql("unary(not){ const(BOOLEAN, true)[4...8] }[0...8]");
    p1.source.should.eql("not true");
    const p2 = parse("-  5");
    p2.inspect().should.eql("unary(-){ const(NUMBER_BASE10, 5)[3...4] }[0...4]");
    p2.source.should.eql("-  5");
    const p3 = parse("not not true");
    p3.inspect().should.eql("unary(not){ unary(not){ const(BOOLEAN, true)[8...12] }[4...12] }[0...12]");
    p3.source.should.eql("not not true");
  });

  describe("call", () => {
    it("simple", () => {
      const p1 = parse("a b");
      p1.inspect().should.eql("call{ a[0...1], b[2...3] }[0...3]");
      p1.source.should.eql("a b");
      const p2 = parse("3 .+");
      p2.inspect().should.eql("call{ const(NUMBER_BASE10, 3)[0...1], const(SYMBOL, +)[2...4] }[0...4]");
      p2.source.should.eql("3 .+");
    });

    it("compound", () => {
      const p1 = parse("widget.draw()");
      p1.inspect().should.eql("call{ " +
        "call{ widget[0...6], const(SYMBOL, draw)[6...11] }[0...11], " +
        "const(NOTHING, ())[11...13]" +
      " }[0...13]");
      p1.source.should.eql("widget.draw()");
      const p2 = parse("widget .height .subtract 3");
      p2.inspect().should.eql("call{ " +
        "call{ " +
          "call{ widget[0...6], const(SYMBOL, height)[7...14] }[0...14], " +
          "const(SYMBOL, subtract)[15...24]" +
        " }[0...24], " +
        "const(NUMBER_BASE10, 3)[25...26]" +
      " }[0...26]");
      p2.source.should.eql("widget .height .subtract 3");
    });

    it("with struct", () => {
      const p1 = parse("b.add(4, 5)");
      p1.inspect().should.eql("call{ " +
        "call{ b[0...1], const(SYMBOL, add)[1...5] }[0...5], " +
        "struct{ " +
          "field{ const(NUMBER_BASE10, 4)[6...7] }[6...7], " +
          "field{ const(NUMBER_BASE10, 5)[9...10] }[9...10]" +
        " }[5...11]" +
      " }[0...11]");
      p1.source.should.eql("b.add(4, 5)");
    });

    it("multi-line", () => {
      const p1 = parse("a .b \\\n  .c");
      p1.inspect().should.eql("call{ " +
        "call{ a[0...1], const(SYMBOL, b)[2...4] }[0...4], " +
        "const(SYMBOL, c)[9...11]" +
      " }[0...11]");
      p1.source.should.eql("a .b \\\n  .c");
    });
  });

  describe("binary", () => {
    it("**", () => {
      const p1 = parse("2 ** 3 ** 4");
      p1.inspect().should.eql("binary(**){ " +
        "binary(**){ const(NUMBER_BASE10, 2)[0...1], const(NUMBER_BASE10, 3)[5...6] }[0...6], " +
        "const(NUMBER_BASE10, 4)[10...11]" +
      " }[0...11]");
      p1.source.should.eql("2 ** 3 ** 4");
    });

    it("* / %", () => {
      const p1 = parse("a * b / c % d");
      p1.inspect().should.eql("binary(%){ " +
        "binary(/){ " +
          "binary(*){ a[0...1], b[4...5] }[0...5], " +
          "c[8...9]" +
        " }[0...9], " +
        "d[12...13]" +
      " }[0...13]");
      p1.source.should.eql("a * b / c % d");
    });

    it("+ -", () => {
      const p1 = parse("a + b - c");
      p1.inspect().should.eql("binary(-){ " +
        "binary(+){ a[0...1], b[4...5] }[0...5], " +
        "c[8...9]" +
      " }[0...9]");
      p1.source.should.eql("a + b - c");
    });

    it("* vs + precedence", () => {
      const p1 = parse("a + b * c + d");
      p1.inspect().should.eql("binary(+){ " +
        "binary(+){ a[0...1], binary(*){ b[4...5], c[8...9] }[4...9] }[0...9], " +
        "d[12...13]" +
      " }[0...13]");
      p1.source.should.eql("a + b * c + d");
    });

    it("+, ==, and precedence", () => {
      const p1 = parse("a and b + c == d");
      p1.inspect().should.eql("binary(and){ " +
        "a[0...1], " +
        "binary(==){ binary(+){ b[6...7], c[10...11] }[6...11], d[15...16] }[6...16]" +
      " }[0...16]");
      p1.source.should.eql("a and b + c == d");
    });

    it("and, or", () => {
      const p1 = parse("true or 3 == 1 and false");
      p1.inspect().should.eql(
        "binary(or){ " +
          "const(BOOLEAN, true)[0...4], " +
          "binary(and){ " +
            "binary(==){ const(NUMBER_BASE10, 3)[8...9], const(NUMBER_BASE10, 1)[13...14] }[8...14], " +
            "const(BOOLEAN, false)[19...24]" +
          " }[8...24]" +
        " }[0...24]"
      );
      p1.source.should.eql("true or 3 == 1 and false");
    });

    it("can span multiple lines", () => {
      const p1 = parse("3 + \n  4");
      p1.inspect().should.eql("binary(+){ " +
        "const(NUMBER_BASE10, 3)[0...1], " +
        "const(NUMBER_BASE10, 4)[7...8]" +
      " }[0...8]");
      p1.source.should.eql("3 + \n  4");
    });

    it("with comment", () => {
      const p1 = parse("3 + # add numbers\n  4");
      p1.inspect().should.eql("binary(+){ " +
        "const(NUMBER_BASE10, 3)[0...1], " +
        "const(NUMBER_BASE10, 4)[20...21]" +
      " }[0...21]");
      p1.source.should.eql("3 + # add numbers\n  4");
    });

    it("notices a missing argument", () => {
      (() => parse("3 +")).should.throw(/Expected operand/);
      (() => parse("3 + 6 *")).should.throw(/Expected operand/);
    });
  });

  describe("if", () => {
    it("if _ then _", () => {
      const p1 = parse("if x < 0 then x");
      p1.inspect().should.eql("if{ " +
        "binary(<){ x[3...4], const(NUMBER_BASE10, 0)[7...8] }[3...8], " +
        "x[14...15]" +
      " }[0...15]");
      p1.source.should.eql("if x < 0 then x");
    });

    it("if _ then _ else _", () => {
      const p1 = parse("if x < 0 then -x else x");
      p1.inspect().should.eql("if{ " +
        "binary(<){ x[3...4], const(NUMBER_BASE10, 0)[7...8] }[3...8], " +
        "unary(-){ x[15...16] }[14...16], " +
        "x[22...23]" +
      " }[0...23]");
      p1.source.should.eql("if x < 0 then -x else x");
    });

    it("if {block} then _ else _", () => {
      const p1 = parse("if { 3; true } then 1 else 2");
      p1.inspect().should.eql("if{ " +
        "block{ " +
          "const(NUMBER_BASE10, 3)[5...6], " +
          "const(BOOLEAN, true)[8...12]" +
        " }[3...14], " +
        "const(NUMBER_BASE10, 1)[20...21], " +
        "const(NUMBER_BASE10, 2)[27...28]" +
      " }[0...28]");
      p1.source.should.eql("if { 3; true } then 1 else 2");
    });

    it("nested", () => {
      const p1 = parse("if a then (if b then 3) else 9");
      p1.inspect().should.eql("if{ " +
        "a[3...4], nested{ " +
          "if{ b[14...15], const(NUMBER_BASE10, 3)[21...22] }[11...22]" +
        " }[10...23], " +
        "const(NUMBER_BASE10, 9)[29...30]" +
      " }[0...30]");
      p1.source.should.eql("if a then (if b then 3) else 9");
    });

    it("failing", () => {
      (() => parse("if ???")).should.throw(/Expected expression/);
      (() => parse("if 3 then ???")).should.throw(/Expected expression/);
      (() => parse("if 3 then 3 else ???")).should.throw(/Expected expression/);
    });
  });

  it("repeat", () => {
    const p1 = parse("repeat 3");
    p1.inspect().should.eql("repeat{ const(NUMBER_BASE10, 3)[7...8] }[0...8]");
    p1.source.should.eql("repeat 3");
    const p2 = parse("repeat { if true then break }");
    p2.inspect().should.eql(
      "repeat{ block{ if{ const(BOOLEAN, true)[12...16], break[22...27] }[9...27] }[7...29] }[0...29]"
    );
    p2.source.should.eql("repeat { if true then break }");
  });

  it("while", () => {
    const p1 = parse("while true do false");
    p1.inspect().should.eql("while{ const(BOOLEAN, true)[6...10], const(BOOLEAN, false)[14...19] }[0...19]");
    p1.source.should.eql("while true do false");
  });
});
