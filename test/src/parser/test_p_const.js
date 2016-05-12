"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.constant.run(s, options).inspect();

describe("Parse constants", () => {
  it("nothing", () => {
    parse("()").should.eql("const(NOTHING)[0:2]");
  });

  it("boolean", () => {
    parse("true").should.eql("const(BOOLEAN, true)[0:4]");
    parse("false").should.eql("const(BOOLEAN, false)[0:5]");
  });

  it("symbol", () => {
    parse(".hello").should.eql("const(SYMBOL, hello)[0:6]");
    parse(".xx_").should.eql("const(SYMBOL, xx_)[0:4]");
    parse(".a3").should.eql("const(SYMBOL, a3)[0:3]");
    parse(":inspect").should.eql("const(SYMBOL, :inspect)[0:8]");
  });

  it("opref", () => {
    parse(".+").should.eql("const(SYMBOL, +)[0:2]");
    parse(".>").should.eql("const(SYMBOL, >)[0:2]");
    parse(".>>").should.eql("const(SYMBOL, >>)[0:3]");
    (() => parse(".?")).should.throw(/Invalid symbol/);
  });

  it("base 10", () => {
    parse("23").should.eql("const(NUMBER_BASE10, 23)[0:2]");
    parse("0").should.eql("const(NUMBER_BASE10, 0)[0:1]");
    parse("919").should.eql("const(NUMBER_BASE10, 919)[0:3]");
    parse("1.2").should.eql("const(NUMBER_BASE10, 1.2)[0:3]");
    parse("500.2").should.eql("const(NUMBER_BASE10, 500.2)[0:5]");
    parse("4e900").should.eql("const(NUMBER_BASE10, 4e900)[0:5]");
    parse("3.14e-02").should.eql("const(NUMBER_BASE10, 3.14e-02)[0:8]");
  });

  it("base 10", () => {
    parse("23").should.eql("const(NUMBER_BASE10, 23)[0:2]");
    parse("0").should.eql("const(NUMBER_BASE10, 0)[0:1]");
    parse("919").should.eql("const(NUMBER_BASE10, 919)[0:3]");
    parse("1.2").should.eql("const(NUMBER_BASE10, 1.2)[0:3]");
    parse("500.2").should.eql("const(NUMBER_BASE10, 500.2)[0:5]");
    parse("4e900").should.eql("const(NUMBER_BASE10, 4e900)[0:5]");
    parse("3.14e-02").should.eql("const(NUMBER_BASE10, 3.14e-02)[0:8]");
  });

  it("base 16", () => {
    parse("0x2f").should.eql("const(NUMBER_BASE16, 2f)[0:4]");
    parse("0xcc1").should.eql("const(NUMBER_BASE16, cc1)[0:5]");
    (() => parse("0xqqq")).should.throw(/Hex constant must contain only/);
  });

  it("base 2", () => {
    parse("0b11").should.eql("const(NUMBER_BASE2, 11)[0:4]");
    parse("0b1010").should.eql("const(NUMBER_BASE2, 1010)[0:6]");
    (() => parse("0bqqq")).should.throw(/Binary constant must contain only/);
  });

  describe("string", () => {
    it("empty", () => {
      parse("\"\"").should.eql("const(STRING, )[0:2]");
    });

    it("simple", () => {
      parse("\"hello\"").should.eql("const(STRING, hello)[0:7]");
    });

    it("with quotes", () => {
      parse("\"quote \\\" ha\"").should.eql("const(STRING, quote \" ha)[0:13]");
    });

    it("with escapes", () => {
      parse("\"\\e[34m\"").should.eql("const(STRING, \u001b[34m)[0:8]");
      (() => parse("\"\\u99\"")).should.match(/Illegal/);
      (() => parse("\"\\ucats\"")).should.match(/Illegal/);
      parse("\"what\\u2022?\"").should.eql("const(STRING, what\u2022?)[0:13]");
      parse("\"what\\nup\\rup\"").should.eql("const(STRING, what\nup\rup)[0:14]");
    });

    it("unterminated", () => {
      (() => parse("\"hello")).should.match(/Unterminated string/);
    });
  });

  it("gibberish", () => {
    (() => parse("^^^")).should.match(/Expected constant/);
  });
});
