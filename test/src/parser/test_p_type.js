"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.typedecl.run(s, options).inspect();

describe("Parse types", () => {
  it("simple", () => {
    parse("Int").should.eql("type(Int)[0:3]");
    (() => parse("int")).should.throw(/type/);
    parse("@").should.eql("type(@)[0:1]");
  });

  it("compound", () => {
    parse("(n:Int,s:String)").should.eql(
      "compoundType(field(n)(type(Int)[3:6])[1:2], field(s)(type(String)[9:15])[7:8])[0:16]"
    );
    parse("( n: Int, s: String )").should.eql(
      "compoundType(field(n)(type(Int)[5:8])[2:3], field(s)(type(String)[13:19])[10:11])[0:21]"
    );
    parse("(x: Int, y:String)").should.eql(
      "compoundType(field(x)(type(Int)[4:7])[1:2], field(y)(type(String)[11:17])[9:10])[0:18]"
    );
    parse("(x: Int = 4)").should.eql(
      "compoundType(field(x)(type(Int)[4:7], const(NUMBER_BASE10, 4)[10:11])[1:2])[0:12]"
    );
    parse("()").should.eql(
      "compoundType[0:2]"
    );
  });

  it("function", () => {
    parse("Long -> Int").should.eql(
      "functionType(type(Long)[0:4], type(Int)[8:11])[0:11]"
    );

    parse("Boolean -> Long -> Int").should.eql(
      "functionType(type(Boolean)[0:7], functionType(type(Long)[11:15], type(Int)[19:22])[11:22])[0:22]"
    );
  });

  it("template", () => {
    parse("List(Int)").should.eql("templateType(List)(type(Int)[5:8])[0:9]");
    parse("Map(String, Int)").should.eql("templateType(Map)(type(String)[4:10], type(Int)[12:15])[0:16]");
  });

  it("parameter", () => {
    parse("$T").should.eql("parameterType(T)[0:2]");
    parse("List($Element)").should.eql("templateType(List)(parameterType(Element)[5:13])[0:14]");
  });

  it("combined", () => {
    parse("Map(String, List(Int -> (real: Float, imaginary: Float)))").should.eql(
      "templateType(Map)(" +
        "type(String)[4:10], " +
        "templateType(List)(" +
          "functionType(" +
            "type(Int)[17:20], " +
            "compoundType(" +
              "field(real)(type(Float)[31:36])[25:29], " +
              "field(imaginary)(type(Float)[49:54])[38:47]" +
            ")[24:55]" +
          ")[17:55]" +
        ")[12:56]" +
      ")[0:57]"
    );
  });

  it("merged", () => {
    parse("Int | Symbol").should.eql("mergedType(type(Int)[0:3], type(Symbol)[6:12])[0:12]");
    parse("(Int -> Int) | (Symbol -> Int)").should.eql(
      "mergedType(" +
        "functionType(type(Int)[1:4], type(Int)[8:11])[1:11], " +
        "functionType(type(Symbol)[16:22], type(Int)[26:29])[16:29]" +
      ")[0:30]"
    );
  });
});
