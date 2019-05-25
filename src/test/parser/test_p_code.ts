import { parser } from "../../wibble";
import { EngineOptions } from "packrattle";

import "should";
import "source-map-support/register";

const parseCode = (s: string, options: EngineOptions = {}) => {
  return parser.code.run(parser.tokenizer.parser.run(s), options);
};

const parseBlock = (s: string, options: EngineOptions = {}) => {
  return parser.codeBlock.run(parser.tokenizer.parser.run(s), options);
};


describe("Parse code", () => {
  describe("code", () => {
    it("expression", () => {
      parseCode("x + y").inspect().should.eql("binary(+){ x[0...1], y[4...5] }[0...5]");
    });

    it("assignment", () => {
      const p1 = parseCode("count := 9");
      p1.inspect().should.eql("assign{ count[0...5], const(NUMBER_BASE10, 9)[9...10] }[0...10]");
      p1.source().should.eql("count := 9");
      const p2 = parseCode("count := count + 1");
      p2.inspect().should.eql(
        "assign{ count[0...5], binary(+){ count[9...14], const(NUMBER_BASE10, 1)[17...18] }[9...18] }[0...18]"
      );
      p2.source().should.eql("count := count + 1");
    });

    it("return", () => {
      const p1 = parseCode("return 3");
      p1.inspect().should.eql(
        "return{ const(NUMBER_BASE10, 3)[7...8] }[0...8]"
      );
      p1.source().should.eql("return 3");
    });

    it("break", () => {
      const p1 = parseCode("break");
      p1.inspect().should.eql("break[0...5]");
      p1.source().should.eql("break");
      const p2 = parseCode("break 0xff");
      p2.inspect().should.eql("break{ const(NUMBER_BASE16, ff)[6...10] }[0...10]");
      p2.source().should.eql("break 0xff");
    });

    describe("let", () => {
      it("simple", () => {
        const p1 = parseCode("let x = 100");
        p1.inspect().should.eql("let{ local(x){ const(NUMBER_BASE10, 100)[8...11] }[4...11] }[0...11]");
        p1.source().should.eql("let x = 100");
        const p2 = parseCode("let var x = 100");
        p2.inspect().should.eql("let{ local-var(x){ const(NUMBER_BASE10, 100)[12...15] }[4...15] }[0...15]");
        p2.source().should.eql("let var x = 100");
      });

      it("compound", () => {
        const p1 = parseCode("let x = 5, var y = 10, z = 3");
        p1.inspect().should.eql(
          "let{ " +
            "local(x){ const(NUMBER_BASE10, 5)[8...9] }[4...9], " +
            "local-var(y){ const(NUMBER_BASE10, 10)[19...21] }[11...21], " +
            "local(z){ const(NUMBER_BASE10, 3)[27...28] }[23...28]" +
          " }[0...28]"
        );
        p1.source().should.eql("let x = 5, var y = 10, z = 3");
        const p2 = parseCode("let var a = 1,\nb = 3");
        p2.inspect().should.eql(
          "let{ " +
          "local-var(a){ const(NUMBER_BASE10, 1)[12...13] }[4...13], " +
          "local(b){ const(NUMBER_BASE10, 3)[19...20] }[15...20]" +
          " }[0...20]"
        );
        p2.source().should.eql("let var a = 1,\nb = 3");
      });
    });

    it("handler", () => {
      const p1 = parseCode("on .peek -> 3");
      p1.inspect().should.eql(
        "on{ const(SYMBOL, peek)[3...8], const(NUMBER_BASE10, 3)[12...13] }[0...13]"
      );
      p1.source().should.eql("on .peek -> 3");
      const p2 = parseCode("on () -> true");
      p2.inspect().should.eql(
        "on{ emptyType[3...5], const(BOOLEAN, true)[9...13] }[0...13]"
      );
      p2.source().should.eql("on () -> true");
      const p3 = parseCode("on (x: Int) -> x * 2");
      p3.inspect().should.eql(
        "on{ " +
          "compoundType{ field(x){ type(Int)[7...10] }[4...10] }[3...11], " +
          "binary(*){ x[15...16], const(NUMBER_BASE10, 2)[19...20] }[15...20]" +
        " }[0...20]"
      );
      p3.source().should.eql("on (x: Int) -> x * 2");
      const p4 = parseCode("on .inspect: String -> false");
      p4.inspect().should.eql(
        "on{ " +
          "const(SYMBOL, inspect)[3...11], " +
          "type(String)[13...19], " +
          "const(BOOLEAN, false)[23...28]" +
        " }[0...28]"
      );
      p4.source().should.eql("on .inspect: String -> false");
      (() => parseCode("on 3 -> 3")).should.throw(/symbol or parameters/);
    });
  });

  describe("block of code", () => {
    it("empty", () => {
      const p1 = parseBlock("{}");
      p1.inspect().should.eql("block[0...2]");
      p1.source().should.eql("{}");
      const p2 = parseBlock("{  }");
      p2.inspect().should.eql("block[0...4]");
      p2.source().should.eql("{  }");
    });

    it("separated by ;", () => {
      const p1 = parseBlock("{ 3; 4 }");
      p1.inspect().should.eql("block{ " +
        "const(NUMBER_BASE10, 3)[2...3], " +
        "const(NUMBER_BASE10, 4)[5...6]" +
      " }[0...8]");
      p1.source().should.eql("{ 3; 4 }");
    });

    it("separated by linefeed", () => {
      const p1 = parseBlock("{\n  true\n  false\n}");
      p1.inspect().should.eql("block{ " +
        "const(BOOLEAN, true)[4...8], " +
        "const(BOOLEAN, false)[11...16]" +
      " }[0...18]");
      p1.source().should.eql("{\n  true\n  false\n}");
    });

    it("comments", () => {
      const p1 = parseBlock("{  # code\n# 3\n  true\n  # ok!\n}");
      p1.inspect().should.eql("block{ " +
        "const(BOOLEAN, true)[16...20]" +
      " }[0...30]");
      p1.source().should.eql("{  # code\n# 3\n  true\n  # ok!\n}");
    });
  });
});
