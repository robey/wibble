"use strict";

import { dump, parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.typedecl.run(s, options);


describe("Dump types", () => {
  it("simple", () => {
    dump.dumpType(parse("Int")).should.eql("Int");
  });

  it("compound", () => {
    dump.dumpType(parse("(x: Int, y: Int = 9)")).should.eql("(x: Int, y: Int = 9)");
  });

  it("template", () => {
    dump.dumpType(parse("List(Int, Int)")).should.eql("List(Int, Int)");
  });

  it("parameter", () => {
    dump.dumpType(parse("$Edge")).should.eql("$Edge");
  });

  it("function", () => {
    dump.dumpType(parse("String -> Int")).should.eql("String -> Int");
  });

  it("divergent", () => {
    dump.dumpType(parse("String | Symbol")).should.eql("String | Symbol");
  });

  it("complex", () => {
    dump.dumpType(parse("(Int)")).should.eql("Int");
    dump.dumpType(parse("(Int) | List(Int)")).should.eql("Int | List(Int)");
    dump.dumpType(parse("(Int -> Int) | (String -> String)")).should.eql("Int -> Int | String -> String");
    dump.dumpType(parse("(Int | String) -> Int")).should.eql("(Int | String) -> Int");
  });
});
