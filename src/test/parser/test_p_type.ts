import { EngineOptions } from "packrattle";
import { parser } from "../../wibble";
import { makeDot } from "./helpers";

import "should";
import "source-map-support/register";

const parse = (s: string, options: EngineOptions = {}) => {
  return parser.typedecl.run(parser.tokenizer.parser.run(s), options);
};

describe("Parse types", () => {
  it("simple", () => {
    parse("Int").inspect().should.eql("type(Int)[0:3]");
    (() => parse("int")).should.throw(/uppercase/);
    parse("@").inspect().should.eql("type(@)[0:1]");
  });

  it("compound", () => {
    const p1 = parse("(n:Int,s:String)");
    p1.inspect().should.eql(
      "compoundType{ field(n){ type(Int)[3:6] }[1:2], field(s){ type(String)[9:15] }[7:8] }[0:16]"
    );
    p1.toCode().should.eql("(n:Int,s:String)");
    const p2 = parse("( n: Int, s: String )");
    p2.inspect().should.eql(
      "compoundType{ field(n){ type(Int)[5:8] }[2:3], field(s){ type(String)[13:19] }[10:11] }[0:21]"
    );
    p2.toCode().should.eql("( n: Int, s: String )");
    const p3 = parse("(x: Int, y:String)");
    p3.inspect().should.eql(
      "compoundType{ field(x){ type(Int)[4:7] }[1:2], field(y){ type(String)[11:17] }[9:10] }[0:18]"
    );
    p3.toCode().should.eql("(x: Int, y:String)");
    const p4 = parse("(x: Int = 4)");
    p4.inspect().should.eql(
      "compoundType{ field(x){ type(Int)[4:7], const(NUMBER_BASE10, 4)[10:11] }[1:2] }[0:12]"
    );
    p4.toCode().should.eql("(x: Int = 4)");
  });

  it("function", () => {
    const p1 = parse("Long -> Int");
    p1.inspect().should.eql(
      "functionType{ type(Long)[0:4], type(Int)[8:11] }[0:11]"
    );
    p1.toCode().should.eql("Long -> Int");

    const p2 = parse("Boolean -> Long -> Int");
    p2.inspect().should.eql(
      "functionType{ type(Boolean)[0:7], functionType{ type(Long)[11:15], type(Int)[19:22] }[11:22] }[0:22]"
    );
    p2.toCode().should.eql("Boolean -> Long -> Int");
  });

  it("template", () => {
    const p1 = parse("List(Int)");
    p1.inspect().should.eql("templateType(List){ type(Int)[5:8] }[0:9]");
    p1.toCode().should.eql("List(Int)");
    const p2 = parse("Map(String, Int)");
    p2.inspect().should.eql("templateType(Map){ type(String)[4:10], type(Int)[12:15] }[0:16]");
    p2.toCode().should.eql("Map(String, Int)");
  });

  it("parameter", () => {
    const p1 = parse("$T");
    p1.inspect().should.eql("parameterType(T)[0:2]");
    p1.toCode().should.eql("$T");
    const p2 = parse("List($Element)");
    p2.inspect().should.eql("templateType(List){ parameterType(Element)[5:13] }[0:14]");
    p2.toCode().should.eql("List($Element)");
  });

  it("combined", () => {
    const p1 = parse("Map(String, List(Int -> (real: Float, imaginary: Float)))");
    p1.inspect().should.eql(
      "templateType(Map){ " +
        "type(String)[4:10], " +
        "templateType(List){ " +
          "functionType{ " +
            "type(Int)[17:20], " +
            "compoundType{ " +
              "field(real){ type(Float)[31:36] }[25:29], " +
              "field(imaginary){ type(Float)[49:54] }[38:47]" +
            " }[24:55]" +
          " }[17:55]" +
        " }[12:56]" +
      " }[0:57]"
    );
    p1.toCode().should.eql("Map(String, List(Int -> (real: Float, imaginary: Float)))");
  });

  it("merged", () => {
    const p1 = parse("Int | Symbol");
    p1.inspect().should.eql("mergedType{ type(Int)[0:3], type(Symbol)[6:12] }[0:12]");
    p1.toCode().should.eql("Int | Symbol");
    const p2 = parse("(Int -> Int) | (Symbol -> Int)");
    p2.inspect().should.eql(
      "mergedType{ " +
        "nestedType{ functionType{ type(Int)[1:4], type(Int)[8:11] }[1:11] }[0:12], " +
        "nestedType{ functionType{ type(Symbol)[16:22], type(Int)[26:29] }[16:29] }[15:30]" +
      " }[0:30]"
    );
    p2.toCode().should.eql("(Int -> Int) | (Symbol -> Int)");
  });

//   it("inline", () => {
//     parse("{}").should.eql("inlineType[0:2]");
//     parse("{ }").should.eql("inlineType[0:3]");
//     parse("{ .+ -> Int -> Int }").should.eql(
//       "inlineType(" +
//         "inlineTypeDeclaration(" +
//           "const(SYMBOL, +)[2:4], " +
//           "functionType(type(Int)[8:11], type(Int)[15:18])[8:18]" +
//         ")[2:18]" +
//       ")[0:20]"
//     );
//     parse("{ (x: Int) -> String }").should.eql(
//       "inlineType(" +
//         "inlineTypeDeclaration(" +
//           "compoundType(field(x)(type(Int)[6:9])[3:4])[2:10], " +
//           "type(String)[14:20]" +
//         ")[2:20]" +
//       ")[0:22]"
//     );
//     parse("{ .name -> String; (x: String) -> Boolean }").should.eql(
//       "inlineType(" +
//         "inlineTypeDeclaration(" +
//           "const(SYMBOL, name)[2:7], " +
//           "type(String)[11:17]" +
//         ")[2:17], " +
//         "inlineTypeDeclaration(" +
//           "compoundType(field(x)(type(String)[23:29])[20:21])[19:30], " +
//           "type(Boolean)[34:41]" +
//         ")[19:41]" +
//       ")[0:43]"
//     );
//   });
});
