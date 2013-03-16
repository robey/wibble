
parser = require("./wibble/parser.coffee")
exports.parser = parser

runtime_base = require("./wibble/runtime_base.coffee")
exports.Scope = runtime_base.Scope

object = require("./wibble/object.coffee")
exports.WObject = object.WObject

types = require("./wibble/types.coffee")
exports.WInt = types.WInt

runtime = require("./wibble/runtime.coffee")
exports.Context = runtime.Context
exports.Runtime = runtime.Runtime

transform = require("./wibble/transform.coffee")
exports.transform = transform.transform
exports.dumpExpr = transform.dumpExpr
