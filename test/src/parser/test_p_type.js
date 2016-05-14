"use strict";

import { parser } from "../../../lib/wibble";

import "should";
import "source-map-support/register";

const parse = (s, options) => parser.typedecl.run(s, options).inspect();

describe("Parse types", () => {
  it("simple", () => {
    parse("Int").should.eql("Type(Int)[0:3]");
    (() => parse("int")).should.throw(/type/);
    parse("@").should.eql("Type(@)[0:1]");
  });

  it("compound", () => {
    parse("(n:Int,s:String)").should.eql(
      "CompoundType(Field(n: Type(Int)[3:6])[1:2], Field(s: Type(String)[9:15])[7:8])[0:16]"
    );
    parse("( n: Int, s: String )").should.eql(
      "CompoundType(Field(n: Type(Int)[5:8])[2:3], Field(s: Type(String)[13:19])[10:11])[0:21]"
    );
    parse("(x: Int, y:String)").should.eql(
      "CompoundType(Field(x: Type(Int)[4:7])[1:2], Field(y: Type(String)[11:17])[9:10])[0:18]"
    );
    parse("(x: Int = 4)").should.eql(
      "CompoundType(Field(x: Type(Int)[4:7] = const(NUMBER_BASE10, 4)[10:11])[1:2])[0:12]"
    );
    parse("()").should.eql(
      "CompoundType[0:2]"
    );
  });

  it("function", () => {
    parse("Long -> Int").should.eql(
      "FunctionType(Type(Long)[0:4], Type(Int)[8:11])[0:11]"
    );

    parse("Boolean -> Long -> Int").should.eql(
      "FunctionType(Type(Boolean)[0:7], FunctionType(Type(Long)[11:15], Type(Int)[19:22])[11:22])[0:22]"
    );
  });

  it("template", () => {
    parse("List(Int)").should.eql("TemplateType(List)(Type(Int)[5:8])[0:9]");
    parse("Map(String, Int)").should.eql("TemplateType(Map)(Type(String)[4:10], Type(Int)[12:15])[0:16]");
  });

  it("parameter", () => {
    parse("$T").should.eql("ParameterType(T)[0:2]");
    parse("List($Element)").should.eql("TemplateType(List)(ParameterType(Element)[5:13])[0:14]");
  });

  it("combined", () => {
    parse("Map(String, List(Int -> (real: Float, imaginary: Float)))").should.eql(
      "TemplateType(Map)(" +
        "Type(String)[4:10], " +
        "TemplateType(List)(" +
          "FunctionType(" +
            "Type(Int)[17:20], " +
            "CompoundType(" +
              "Field(real: Type(Float)[31:36])[25:29], " +
              "Field(imaginary: Type(Float)[49:54])[38:47]" +
            ")[24:55]" +
          ")[17:55]" +
        ")[12:56]" +
      ")[0:57]"
    );
  });

  it("disjoint", () => {
    parse("Int | Symbol").should.eql("DisjointType(Type(Int)[0:3], Type(Symbol)[6:12])[0:12]");
    parse("(Int -> Int) | (Symbol -> Int)").should.eql(
      "DisjointType(" +
        "FunctionType(Type(Int)[1:4], Type(Int)[8:11])[1:11], " +
        "FunctionType(Type(Symbol)[16:22], Type(Int)[26:29])[16:29]" +
      ")[0:30]"
    );
  });
});
