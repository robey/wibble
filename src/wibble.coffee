
parser = require("./wibble/parser.coffee")
exports.parser = parser

runtime_base = require("./wibble/runtime_base.coffee")
exports.Scope = runtime_base.Scope

runtime = require("./wibble/runtime.coffee")
exports.Context = runtime.Context
exports.Runtime = runtime.Runtime
exports.WInt = runtime.WInt

transform = require("./wibble/transform.coffee")
exports.transform = transform.transform
exports.dumpExpr = transform.dumpExpr
