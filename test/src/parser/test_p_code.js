"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parseCode = (s, options) => parser.code.run(s, options).inspect();
const parseBlock = (s, options) => parser.codeBlock.run(s, options).inspect();


describe("Parse code", () => {
  describe("code", () => {
    it("expression", () => {
      parseCode("x + y").should.eql("binary(+)(x[0:1], y[4:5])[0:5]");
    });

    it("assignment", () => {
      parseCode("count := 9").should.eql("assign(count[0:5], const(NUMBER_BASE10, 9)[9:10])[6:8]");
      parseCode("count := count + 1").should.eql(
        "assign(count[0:5], binary(+)(count[9:14], const(NUMBER_BASE10, 1)[17:18])[9:18])[6:8]"
      );
    });

    it("return", () => {
      parseCode("return 3").should.eql(
        "return(const(NUMBER_BASE10, 3)[7:8])[0:6]"
      );
    });

    it("break", () => {
      parseCode("break").should.eql("break[0:5]");
      parseCode("break 0xff").should.eql("break(const(NUMBER_BASE16, ff)[6:10])[0:5]");
    });

    it("let", () => {
      parseCode("let x = 100").should.eql("let(local(x)(const(NUMBER_BASE10, 100)[8:11])[4:5])[0:3]");
      (() => parseCode("let return = 1")).should.throw(/Reserved/);
    });

    it("make", () => {
      parseCode("make x := 100").should.eql("make(local(x)(const(NUMBER_BASE10, 100)[10:13])[5:6])[0:4]");
      (() => parseCode("make return = 1")).should.throw(/Reserved/);
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
          "compoundType(field(x)(type(Int)[7:10])[4:5])[3:11], " +
          "binary(*)(x[15:16], const(NUMBER_BASE10, 2)[19:20])[15:20]" +
        ")[0:2]"
      );
      parseCode("on .inspect: String -> false").should.eql(
        "on(" +
          "const(SYMBOL, inspect)[3:11], " +
          "const(BOOLEAN, false)[23:28], " +
          "type(String)[13:19]" +
        ")[0:2]"
      );
      (() => parseCode("on 3 -> 3")).should.match(/symbol or parameters/);
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

    it("comments", () => {
      parseBlock("{  # code\n# 3\n  true\n  # ok!\n}").should.eql("block(" +
        "const(BOOLEAN, true)#\"# code\\n# 3\"[16:20]" +
      ")##\"# ok!\"[0:30]");
    });
  });
});
