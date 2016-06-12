"use strict";

import { compiler, dump, Errors, parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const typecheck = (s, options = {}) => {
  const errors = new Errors();
  const scope = options.scope || new compiler.Scope();
  const typeScope = options.typeScope || compiler.builtinTypes;
  const expr = (options.parser || parser.expression).run(s, options);
  const simplified = compiler.simplify(expr, errors);
  if (options.logger) options.logger("expr: " + dump.dumpExpr(simplified));
  const type = compiler.typecheck(simplified, errors, scope, typeScope, options.logger);
  if (errors.length > 0) {
    const error = new Error(errors.inspect());
    error.errors = errors;
    if (options.logger) {
      errors.list.forEach(error => {
        options.logger(">> " + error.message);
        error.span.toSquiggles().forEach(s => options.logger(s));
      });
    }
    throw error;
  } else {
    return { type, expr, scope };
  }
};


describe("Typecheck expressions", () => {
  it("constants", () => {
    typecheck("()").type.inspect().should.eql("Nothing");
    typecheck("true").type.inspect().should.eql("Boolean");
    typecheck("3").type.inspect().should.eql("Int");
    typecheck(".foo").type.inspect().should.eql("Symbol");
    typecheck(".*").type.inspect().should.eql("Symbol");
    typecheck("\"hello\"").type.inspect().should.eql("String");
  });

  it("references", () => {
    const scope = new compiler.Scope();
    scope.add("point", new compiler.CReference("point", compiler.newType("Point"), false));
    typecheck("point", { scope }).type.inspect().should.eql("Point");
  });

  it("structs", () => {
    typecheck("(x = 9)").type.inspect().should.eql("(x: Int)");
    typecheck("(x = 9, y = 10)").type.inspect().should.eql("(x: Int, y: Int)");
    typecheck("(.a, .b, .c)").type.inspect().should.eql("(?0: Symbol, ?1: Symbol, ?2: Symbol)");
    (() => typecheck("(count = 10, true)")).should.throw(/Positional fields can.t/);
    typecheck("(true, count = 10)").type.inspect().should.eql("(?0: Boolean, count: Int)");
    (() => typecheck("(a = 1, b = 2, a = 1)")).should.throw(/repeated/);
  });

  describe("new", () => {
    it("symbol", () => {
      const { type, expr } = typecheck("new { on .foo -> 3 }");
      type.inspect().should.eql("{ .foo -> Int }");
      dump.dumpExpr(expr).should.eql("new { on .foo -> 3 }");
      expr.newType.inspect().should.eql("{ .foo -> Int }");
    });

    it("nothing", () => {
      const { type, expr } = typecheck("new { let hidden = .ok; on () -> true }");
      type.inspect().should.eql("() -> Boolean");
      dump.dumpExpr(expr).should.eql("new { let hidden = .ok; on () -> true }");
      expr.newType.inspect().should.eql("() -> Boolean");
      // verify that inner locals were type-checked
      expr.children[0].scope.get("hidden").type.inspect().should.eql("Symbol");
    });

    it("inner reference", () => {
      const { type, expr } = typecheck("new { on (x: Int) -> x }");
      type.inspect().should.eql("(x: Int) -> Int");
      dump.dumpExpr(expr).should.eql("new { on (x: Int) -> x }");
      expr.newType.inspect().should.eql("(x: Int) -> Int");
    });

    it("generates a scope for 'on' handlers", () => {
      const { expr } = typecheck("new { on (x: Int) -> x + 2 }");
      expr.children[0].children[0].scope.get("x").type.inspect().should.eql("Int");
    });

    it("can do forward references from inside the closure", () => {
      typecheck("new { on (x: Int) -> { y + 3 }; let y = 10 }").type.inspect().should.eql("(x: Int) -> Int");
      typecheck("new { on (x: Int) -> { y := 3 }; make y := 10 }").type.inspect().should.eql("(x: Int) -> Int");
    });

    it("can still trap unknown references inside the closure", () => {
      (() => typecheck("new { on (x: Int) -> { y + 3 } }")).should.throw(/reference/);
      (() => typecheck("new { on (x: Int) -> { y := 3 } }")).should.throw(/reference/);
      (() => typecheck("new { on (x: Int) -> { y := 3 }; let y = 10 }")).should.throw(/immutable/);
    });
  });

  it("calls", () => {
    typecheck("3 .+").type.inspect().should.eql("Int -> Int");
    typecheck("(3 .+) 3").type.inspect().should.eql("Int");
  });

  it("logic", () => {
    (() => typecheck("3 and true")).should.throw(/boolean/);
    (() => typecheck("false or 9")).should.throw(/boolean/);
    typecheck("true and true").type.inspect().should.eql("Boolean");
  });

  describe("assignment", () => {
    it("must target mutables", () => {
      (() => typecheck("{ let count = 3; count := 4 }")).should.throw(/immutable/);
      typecheck("{ make count := 3; count := 4 }").type.inspect().should.eql("Int");
    });

    it("must be typesafe", () => {
      (() => typecheck("{ make count := 3; count := false }")).should.throw(/Incompatible types/);
    });
  });

  it("if", () => {
    typecheck("if true then 3 else 4").type.inspect().should.eql("Int");
    typecheck("if true then 3 else true").type.inspect().should.eql("Int | Boolean");
    typecheck("if true then 3").type.inspect().should.eql("Int | Nothing");
    (() => typecheck("if 3 then 3 else 4")).should.throw(/true or false/);

    // check type merging too.
    typecheck("if true then 3 else (if true then false else 4)").type.inspect().should.eql("Int | Boolean");
    typecheck("if true then 9 else (if true then 12 else 13)").type.inspect().should.eql("Int");
  });

  // - PRepeat
  // - PReturn
  // - PBreak

  it("locals", () => {
    typecheck("let x = 3", { parser: parser.code }).type.inspect().should.eql("Nothing");
  });

  describe("block", () => {
    it("empty", () => {
      typecheck("{ }").type.inspect().should.eql("Nothing");
    });

    it("finds a local", () => {
      const { expr, type } = typecheck("{ let x = 9 }");
      type.inspect().should.eql("Nothing");
      expr.scope.get("x").type.inspect().should.eql("Int");
    });

    it("resolves inner references", () => {
      const { expr, type } = typecheck("{ let x = true; x }");
      type.inspect().should.eql("Boolean");
      expr.scope.get("x").type.inspect().should.eql("Boolean");
    });

    it("gets unhappy about duped vars", () => {
      (() => typecheck("{ let x = 9; let x = 3 }")).should.throw(/Redefined/);
    });

    it("gets unhappy about forward references", () => {
      (() => typecheck("{ let y = 3 + x; let x = 9 }")).should.throw(/reference/);
      (() => typecheck("{ q := 9 }")).should.throw(/reference/);
    });

    it("does not allow nested duped vars", () => {
      (() => typecheck("{ let x = 9; { let x = 3 } }")).should.throw(/Redefined local/);
    });
  });

  // -----

  describe("functions", () => {
    it("simple", () => {
      const func = "-> 3";
      typecheck(func).type.inspect().should.eql("() -> Int");
      typecheck(`(${func}) ()`).type.inspect().should.eql("Int");
    });

    it("as function parameters", () => {
      const func = "(f: Int -> Int) -> { (n: Int) -> f n * 2 }";
      typecheck(func).type.inspect().should.eql("(f: Int -> Int) -> (n: Int) -> Int");
      typecheck(`(${func}) ((n: Int) -> n + 1)`).type.inspect().should.eql("(n: Int) -> Int");
    });

    it("with parameters matched contravariantly", () => {
      const func = "(f: Int -> Int) -> { (n: Int) -> f n * 2 }";
      typecheck(`(${func}) ((n: Int, incr: Int = 1) -> n + incr)`).type.inspect().should.eql("(n: Int) -> Int");
    });

    //   it "simple type parameters", ->
    //     func = "(x: $A) -> x"
    //     typecheck(func).type.inspect().should.eql "(x: $A) -> $A"
    //     typecheck("(#{func}) 10").type.inspect().should.eql "Int"
    //
    //   it "type parameters in a disjoint type", ->
    //     func = "(x: $A, y: Boolean) -> if y then x else 100"
    //     typecheck(func).type.inspect().should.eql "(x: $A, y: Boolean) -> ($A | Int)"
    //     typecheck("(#{func}) (10, true)").type.inspect().should.eql "Int"
    //     typecheck("(#{func}) (10, false)").type.inspect().should.eql "Int"

    it("insists that the returned type match the prototype", () => {
      const func = "(n: Int): Int -> true";
      (() => typecheck(func)).should.throw(/Expected type Int; inferred type Boolean/);
    });

    it("unifies struct return types", () => {
      const func = "(n: Int): (x: Int, y: Int) -> (4, 8)";
      typecheck(func).type.inspect().should.eql("(n: Int) -> (x: Int, y: Int)");
    });
  });

  describe("tricksy", () => {
    it("handles single recursion", () => {
      (() => typecheck("{ let sum = (n: Int) -> sum(n - 1) }")).should.throw(/Recursive/);
      typecheck("{ let sum = (n: Int): Int -> if n == 0 then 0 else n + sum(n - 1); sum }").type.inspect().should.eql(
        "(n: Int) -> Int"
      );
    });

    it("checks single recursion", () => {
      typecheck("{ sum = (n: Int) -> n * 2 }").type.inspect().should.eql("(n: Int) -> Int");
      (() => typecheck("{ sum = (n: Int): Int -> .wut }")).should.throw("Expected type Int; inferred type Symbol");
    });

    it("handles double recursion", () => {
      const even = "if n == 0 then 0 else odd(n - 1)";
      const odd = "if n == 1 then 1 else even(n - 1)";
      (() => typecheck(`{ let even = (n: Int) -> ${even}; let odd = (n: Int) -> ${odd} }`)).should.throw(/Recursive/);
      typecheck(`{ let even = (n: Int): Int -> ${even}; let odd = (n: Int): Int -> ${odd} }`).type.inspect().should.eql(
        "(n: Int) -> Int"
      );
    });

    it("handles self-types", () => {
      typecheck("new { on (x: @) -> true }").type.inspect().should.eql("(x: @) -> Boolean");
    });
  });
});
