"use strict";

import { desugar, dump, parser, PState } from "../../../lib/wibble";

import should from "should";
import "source-map-support/register";

const parse = (s, options) => parser.expression.run(s, options);
const simplify = (s, options) => {
  const state = new PState();
  const rv = dump.dumpExpr(desugar.simplify(parse(s, options), state));
  if (state.errors.length > 0) {
    const error = new Error(state.errors.inspect());
    error.errors = state.errors;
    error.dump = rv;
    throw error;
  } else {
    return rv;
  }
};


describe("Desugar expressions", () => {
  it("unary", () => {
    simplify("not a").should.eql("a .not");
    simplify("-a").should.eql("a .negative");
  });

  it("binary", () => {
    simplify("3 + 4").should.eql("3 .+ 4");
    simplify("a + b * c + d").should.eql("a .+ (b .* c) .+ d");
    simplify("a + b * (c + d)").should.eql("a .+ (b .* (c .+ d))");
    simplify("x or y").should.eql("x or y");
  });

  it("if", () => {
    simplify("if a then b else c").should.eql("if a then b else c");
    simplify("if a then b").should.eql("if a then b else ()");
  });

  it("struct", () => {
    simplify("(1, 2)").should.eql("(?0=1, ?1=2)");
    simplify("(4, x=9)").should.eql("(?0=4, x=9)");
    simplify("(z=4, x=9)").should.eql("(z=4, x=9)");

    should.throws(() => simplify("(y=4, 9)"), error => {
      error.dump.should.eql("(y=4, ?1=9)");
      error.errors.inspect().should.match(/\[6:7\] Positional fields/);
      return true;
    });

    should.throws(() => simplify("(y=4, 9, 7)"), error => {
      error.dump.should.eql("(y=4, ?1=9, ?2=7)");
      error.errors.inspect().should.match(/\[6:7\] Positional fields/);
      error.errors.inspect().should.match(/\[9:10\] Positional fields/);
      return true;
    });
  });

  it("function", () => {
    simplify("(n: Int) -> n * 2").should.eql("new on (n: Int) -> n .* 2");
  });

  it("block", () => {
    simplify("{ 4; 5 }").should.eql("{ 4; 5 }");
    simplify("{ 4 }").should.eql("4");
    simplify("{ let x = 3 }").should.eql("{ let x = 3 }");
  });

  it("new/on", () => {
    simplify("new { on .x -> 3 }").should.eql("new on .x -> 3");
  });

  it("while", () => {
    simplify("while true do 13").should.eql(
      "if true then repeat { let ?0 = 13; if true .not then break ?0 else () } else ()"
    );
    simplify("while x > 5 do { x := x - 1 }").should.eql(
      "if x .> 5 then repeat { let ?0 = x := x .- 1; if x .> 5 .not then break ?0 else () } else ()"
    );
  });

  it("break", () => {
    simplify("repeat { break 10 }").should.eql("repeat break 10");
    should.throws(() => simplify("if true then { 10; break 11 }"), error => {
      error.dump.should.eql("if true then { 10; break 11 } else ()");
      error.errors.inspect().should.match(/\[19:24\] 'break'/);
      return true;
    });
  });

  it("nested", () => {
    simplify("45 * -9").should.eql("45 .* (9 .negative)");
    simplify("if 3 + 5 < 12 then ok").should.eql("if 3 .+ 5 .< 12 then ok else ()");
    simplify("3 + 5 and 9 - 2").should.eql("3 .+ 5 and 9 .- 2");
  });
});
