"use strict";

function uncstring(s) {
  return s.replace(/\\(u(.{0,4})|.)/g, (match, c, hex) => {
    if (hex) {
      // uHHHH
      if (!hex.match(/[0-9a-fA-F]{4}/)) throw new Error("Illegal \\uHHHH code");
      return String.fromCharCode(parseInt(hex, 16));
    }
    switch (c) {
      case 'b': return "\u0008";
      case 'e': return "\u001b";
      case 'n': return "\n";
      case 'r': return "\r";
      case 't': return "\t";
      default: return c;
    }
  });
}


exports.uncstring = uncstring;
