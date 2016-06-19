"use strict";

import { compiler, dump, Errors, parser } from "../../../lib/wibble";

import should from "should";
import "source-map-support/register";

const parse = (s, options) => parser.code.run(s, options);
const simplify = (s, options) => {
  const errors = new Errors();
  const rv = dump.dumpExpr(compiler.simplify(parse(s, options), errors));
  if (errors.length > 0) {
    const error = new Error(errors.inspect());
    error.errors = errors;
    error.dump = rv;
    throw error;
  } else {
    return rv;
  }
};


describe("Simplify expressions", () => {
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

  it("assignment", () => {
    simplify("{ x := 3 }").should.eql("{ x := 3 }");
    should.throws(() => simplify("{ y + (x := 3) }"), error => {
      error.dump.should.eql("y .+ (x := 3)");
      error.errors.inspect().should.match(/\[9:11\] mutable assignments/);
      return true;
    });
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
    simplify("(a: Int, b: Int): Int -> a + b + calc(b)").should.eql(
      "new on (a: Int, b: Int): Int -> a .+ b .+ (calc b)"
    );
  });

  it("block", () => {
    simplify("{ 4; 5 }").should.eql("{ 4; 5 }");
    simplify("{ 4 }").should.eql("4");
    simplify("{ let x = 3 }").should.eql("{ let x = 3 }");
  });

  it("new/on", () => {
    simplify("new { on .x -> 3 }").should.eql("new { on .x -> 3 }");
  });

  it("while", () => {
    simplify("while true do 13").should.eql(
      "if true then repeat { let _0 = 13; if true .not then break _0 else () } else ()"
    );
    simplify("while x > 5 do { x := x - 1 }").should.eql(
      "if x .> 5 then repeat { let _0 = { x := x .- 1 }; if x .> 5 .not then break _0 else () } else ()"
    );
  });

  it("return", () => {
    simplify("() -> return 3").should.eql(
      "new on () -> return 3"
    );
    should.throws(() => simplify("x := { return 3 }"), error => {
      error.errors.inspect().should.match(/\[7:13\] 'return'/);
      return true;
    });
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
