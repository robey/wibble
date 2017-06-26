import * as fs from "fs";

export function makeDot(s: string) {
  fs.writeFileSync("debug.dot", Buffer.from(s));
}
