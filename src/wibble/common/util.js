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

function cstring(s) {
  return s.replace(/[^\u0020-\u007e]|\"/g, c => {
    if (c == '"') return "\\\"";
    const n = c.charCodeAt(0);
    switch (n) {
      case 8: return "\\b";
      case 9: return "\\t";
      case 10: return "\\n";
      case 13: return "\\r";
      case 27: return "\\e";
      default:
        const escape = "000" + n.toString(16);
        return "\\u" + escape.slice(escape.length - 4);
    }
  });
}


exports.cstring = cstring;
exports.uncstring = uncstring;
