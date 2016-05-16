"use strict";

import { dump, parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.expression.run(s, options);
const parseCode = (s, options) => parser.code.run(s, options);


describe("Dump expressions", () => {
  describe("constants", () => {
    it("nothing", () => {
      dump.dumpExpr(parse("()")).should.eql("()");
    });

    it("boolean", () => {
      dump.dumpExpr(parse("true")).should.eql("true");
      dump.dumpExpr(parse("false")).should.eql("false");
    });

    it("symbol", () => {
      dump.dumpExpr(parse(".name")).should.eql(".name");
      dump.dumpExpr(parse(".==")).should.eql(".==");
    });

    it("number", () => {
      dump.dumpExpr(parse("23")).should.eql("23");
      dump.dumpExpr(parse("0xfe")).should.eql("0xfe");
      dump.dumpExpr(parse("0b11")).should.eql("0b11");
    });

    it("string", () => {
      dump.dumpExpr(parse("\"hello\"")).should.eql("\"hello\"");
      dump.dumpExpr(parse("\"no\\u{21}\"")).should.eql("\"no!\"");
    });
  });

  it("reference", () => {
    dump.dumpExpr(parse("table")).should.eql("table");
  });

  it("array", () => {
    dump.dumpExpr(parse("[true,3]")).should.eql("[ true, 3 ]");
  });

  it("function", () => {
    dump.dumpExpr(parse("-> true")).should.eql("-> true");
    dump.dumpExpr(parse("(n: Int) -> n * 2")).should.eql("(n: Int) -> n * 2");
    dump.dumpExpr(parse("(a: Boolean = false) -> true")).should.eql("(a: Boolean = false) -> true");
    dump.dumpExpr(parse("(x: (names: List(String), title: String)) -> true")).should.eql(
      "(x: (names: List(String), title: String)) -> true"
    );
    dump.dumpExpr(parse("(): Int -> 3")).should.eql("(): Int -> 3");
  });

  it("struct", () => {
    dump.dumpExpr(parse("(9,4)")).should.eql("(9, 4)");
    dump.dumpExpr(parse("(x = true, y = 9)")).should.eql("(x=true, y=9)");
  });

  it("new", () => {
    dump.dumpExpr(parse("new { true }")).should.eql("new { true }");
  });

  it("unary", () => {
    dump.dumpExpr(parse("-x")).should.eql("-x");
    dump.dumpExpr(parse("not y")).should.eql("not y");
    dump.dumpExpr(parse("not (x or y)")).should.eql("not (x or y)");
  });

  it("call", () => {
    dump.dumpExpr(parse("3 .sqrt")).should.eql("3 .sqrt");
  });

  it("binary", () => {
    dump.dumpExpr(parse("2 + x")).should.eql("2 + x");
    dump.dumpExpr(parse("x**(y+1)")).should.eql("x ** (y + 1)");
    dump.dumpExpr(parse("3 * 4 + 5 * 6")).should.eql("3 * 4 + 5 * 6");
    dump.dumpExpr(parse("x<9 and x>4")).should.eql("x < 9 and x > 4");
  });

  it("assignment", () => {
    dump.dumpExpr(parse("x := 3 .sqrt")).should.eql("x := 3 .sqrt");
  });

  it("if", () => {
    dump.dumpExpr(parse("if y<2 then 100")).should.eql("if y < 2 then 100");
    dump.dumpExpr(parse("if y<4 then 100 else 50")).should.eql("if y < 4 then 100 else 50");
  });

  it("repeat", () => {
    dump.dumpExpr(parse("repeat 100")).should.eql("repeat 100");
  });

  it("while", () => {
    dump.dumpExpr(parse("while true do false")).should.eql("while true do false");
    dump.dumpExpr(parse("while y < 5 do y := y + 1")).should.eql("while y < 5 do y := y + 1");
  });

  it("return", () => {
    dump.dumpExpr(parse("return 100")).should.eql("return 100");
  });

  it("break", () => {
    dump.dumpExpr(parse("break")).should.eql("break");
    dump.dumpExpr(parse("break 100")).should.eql("break 100");
  });

  it("locals", () => {
    dump.dumpExpr(parseCode("let x=3")).should.eql("let x = 3");
    dump.dumpExpr(parseCode("let x=3, y=7")).should.eql("let x = 3, y = 7");
    dump.dumpExpr(parseCode("make x:=3")).should.eql("make x := 3");
    dump.dumpExpr(parseCode("make x:=3, y:=7")).should.eql("make x := 3, y := 7");
  });

  it("on", () => {
    dump.dumpExpr(parseCode("on .say -> 13")).should.eql("on .say -> 13");
    dump.dumpExpr(parseCode("on (x: Int) -> x * 22")).should.eql("on (x: Int) -> x * 22");
  });

  it("block", () => {
    dump.dumpExpr(parseCode("{ true; 8; .ok }")).should.eql("{ true; 8; .ok }");
  });
});


// describe "Dump expressions", ->

//   it "dump locals", ->
//     dump.dumpExpr(parse("{ x = 9 + a }")).should.eql("{ x = 9 + a }")
//     dump.dumpExpr(parse("{ mutable count = x }")).should.eql("{ mutable count = x }")
//
//   it "dump assignments", ->
//     dump.dumpExpr(parse("{ count := x + 1 }")).should.eql("{ count := x + 1 }")
//
//   it "dump handlers", ->
//     dump.dumpExpr(parse("{ on .start -> true }")).should.eql("{ on .start -> true }")
//     dump.dumpExpr(parse("{ on (x: Int) -> { 16 } }")).should.eql("{ on (x: Int) -> { 16 } }")
//
//   it "dump return", ->
//     dump.dumpExpr(parse("{ return if true then 3 else 4 }")).should.eql("{ return if true then 3 else 4 }")
