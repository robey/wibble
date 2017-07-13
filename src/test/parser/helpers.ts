import * as fs from "fs";
import { Parser } from "packrattle";

export function makeDot(s: string) {
  fs.writeFileSync("debug.dot", Buffer.from(s));
}

export function saveParser<A, Out>(p: Parser<A, Out>) {
  fs.writeFileSync("parser.dot", Buffer.from(p.toDot()));
}
