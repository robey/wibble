require("source-map-support").install()

parser = require './wibble/parser'
exports.parser = parser

dump = require './wibble/dump'
exports.dumpExpr = dump.dumpExpr
exports.dumpType = dump.dumpType

transform = require './wibble/transform'
exports.transform = transform

runtime = require './wibble/runtime'
exports.runtime = runtime

repl = require './repl'
exports.repl = repl
