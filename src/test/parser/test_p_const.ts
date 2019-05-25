import { EngineOptions } from "packrattle";
import { parser } from "../../wibble";

import "should";
import "source-map-support/register";

const parse = (s: string, options: EngineOptions = {}) => {
  return parser.constant.run(parser.tokenizer.parser.run(s), options);
};

describe("Parse constants", () => {
  it("nothing", () => {
    parse("()").inspect().should.eql("const(NOTHING, ())[0...2]");
    parse("()").source().should.eql("()");
  });

  it("boolean", () => {
    parse("true").inspect().should.eql("const(BOOLEAN, true)[0...4]");
    parse("false").inspect().should.eql("const(BOOLEAN, false)[0...5]");
    parse("true").source().should.eql("true");
  });

  it("symbol", () => {
    parse(".hello").inspect().should.eql("const(SYMBOL, hello)[0...6]");
    parse(".xx_").inspect().should.eql("const(SYMBOL, xx_)[0...4]");
    parse(".a3").inspect().should.eql("const(SYMBOL, a3)[0...3]");
    parse(".hello").source().should.eql(".hello");
  });

  it("opref", () => {
    parse(".+").inspect().should.eql("const(SYMBOL, +)[0...2]");
    parse(".>").inspect().should.eql("const(SYMBOL, >)[0...2]");
    parse(".>=").inspect().should.eql("const(SYMBOL, >=)[0...3]");
    (() => parse(".?")).should.throw(/Invalid symbol/);
    parse(".+").source().should.eql(".+");
  });

  it("base 10", () => {
    parse("23").inspect().should.eql("const(NUMBER_BASE10, 23)[0...2]");
    parse("0").inspect().should.eql("const(NUMBER_BASE10, 0)[0...1]");
    parse("919").inspect().should.eql("const(NUMBER_BASE10, 919)[0...3]");
    parse("1.2").inspect().should.eql("const(NUMBER_BASE10, 1.2)[0...3]");
    parse("500.2").inspect().should.eql("const(NUMBER_BASE10, 500.2)[0...5]");
    parse("4e900").inspect().should.eql("const(NUMBER_BASE10, 4e900)[0...5]");
    parse("3.14e-02").inspect().should.eql("const(NUMBER_BASE10, 3.14e-02)[0...8]");
    parse("23").source().should.eql("23");
  });

  it("base 16", () => {
    parse("0x2f").inspect().should.eql("const(NUMBER_BASE16, 2f)[0...4]");
    parse("0xcc1").inspect().should.eql("const(NUMBER_BASE16, cc1)[0...5]");
    (() => parse("0xqqq")).should.throw(/Expected end/);
    parse("0x2f").source().should.eql("0x2f");
  });

  it("base 2", () => {
    parse("0b11").inspect().should.eql("const(NUMBER_BASE2, 11)[0...4]");
    parse("0b1010").inspect().should.eql("const(NUMBER_BASE2, 1010)[0...6]");
    (() => parse("0bqqq")).should.throw(/Expected end/);
    parse("0b11").source().should.eql("0b11");
  });

  describe("string", () => {
    it("empty", () => {
      parse("\"\"").inspect().should.eql("const(STRING, )[0...2]");
      parse("\"\"").source().should.eql("\"\"");
    });

    it("simple", () => {
      parse("\"hello\"").inspect().should.eql("const(STRING, hello)[0...7]");
    });

    it("with quotes", () => {
      parse("\"quote \\\" ha\"").inspect().should.eql("const(STRING, quote \" ha)[0...13]");
      parse("\"quote \\\" ha\"").source().should.eql("\"quote \\\" ha\"");
    });

    it("with escapes", () => {
      parse("\"\\e[34m\"").inspect().should.eql("const(STRING, \u001b[34m)[0...8]");
      (() => parse("\"\\u99\"")).should.throw(/Truncated/);
      (() => parse("\"\\ucats\"")).should.throw(/Illegal/);
      parse("\"what\\u2022?\"").inspect().should.eql("const(STRING, what\u2022?)[0...13]");
      parse("\"what\\nup\\rup\"").inspect().should.eql("const(STRING, what\nup\rup)[0...14]");
      parse("\"what\\u{21}?\"").inspect().should.eql("const(STRING, what!?)[0...13]");
      parse("\"what\\u{21}?\"").source().should.eql("\"what\\u{21}?\"");
    });
  });

  it("gibberish", () => {
    (() => parse("^^^")).should.throw(/Expected constant/);
  });
});
