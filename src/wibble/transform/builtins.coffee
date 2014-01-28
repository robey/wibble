util = require 'util'
parser = require '../parser'
t_type = require './t_type'

compileDescriptor = (name, table) ->
  handlers = []
  for k, v of table
    argType = if k[0] == "." then k[1...] else t_type.buildType(parser.typedecl.run(k))
    resultType = t_type.buildType(parser.typedecl.run(v))
    handlers.push [ argType, resultType ]
  new t_type.NamedType(name, handlers)

DAny = compileDescriptor "Any", {}

DBoolean = compileDescriptor "Boolean", {}

DInt = compileDescriptor "Int",
  ".+": "Int -> Int"
  ".-": "Int -> Int"
  ".*": "Int -> Int"
  "./": "Int -> Int"
  ".%": "Int -> Int"
  ".positive": "() -> Int"
  ".negative": "() -> Int"

DNothing = compileDescriptor "Nothing", {}

DString = compileDescriptor "String", {}

DSymbol = compileDescriptor "Symbol", {}

descriptors = {}
descriptors[DAny.name] = DAny
descriptors[DBoolean.name] = DBoolean
descriptors[DInt.name] = DInt
descriptors[DNothing.name] = DNothing
descriptors[DString.name] = DString
descriptors[DSymbol.name] = DSymbol


exports.DAny = DAny
exports.DBoolean = DBoolean
exports.DInt = DInt
exports.DNothing = DNothing
exports.DString = DString
exports.DSymbol = DSymbol
exports.descriptors = descriptors
