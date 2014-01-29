util = require 'util'
parser = require '../parser'
t_type = require './t_type'

compileDescriptor = (type, table) ->
  handlers = []
  for k, v of table
    argType = if k[0] == "." then k[1...] else t_type.findType(parser.typedecl.run(k), typemap)
    resultType = t_type.findType(parser.typedecl.run(v), typemap)
    handlers.push [ argType, resultType ]
  type.handlers = handlers

DAny = new t_type.NamedType("Any")
DBoolean = new t_type.NamedType("Boolean")
DInt = new t_type.NamedType("Int")
DNothing = new t_type.NamedType("Nothing")
DString = new t_type.NamedType("String")
DSymbol = new t_type.NamedType("Symbol")

typemap = {}
typemap[DAny.name] = DAny
typemap[DBoolean.name] = DBoolean
typemap[DInt.name] = DInt
typemap[DNothing.name] = DNothing
typemap[DString.name] = DString
typemap[DSymbol.name] = DSymbol

# types are often self-referential, so do them after all the names are set.
compileDescriptor DInt,
  ".+": "Int -> Int"
  ".-": "Int -> Int"
  ".*": "Int -> Int"
  "./": "Int -> Int"
  ".%": "Int -> Int"
  ".positive": "() -> Int"
  ".negative": "() -> Int"

exports.DAny = DAny
exports.DBoolean = DBoolean
exports.DInt = DInt
exports.DNothing = DNothing
exports.DString = DString
exports.DSymbol = DSymbol
exports.typemap = typemap
