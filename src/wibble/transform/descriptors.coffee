util = require 'util'
parser = require '../parser'
t_type = require './t_type'

DAny = new t_type.NamedType("Any")
DAny.canCoerceFrom = (other) -> true

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

t_type.addHandlers DBoolean, typemap,
  ".not": "Boolean"

t_type.addHandlers DInt, typemap,
  ".+": "Int -> Int"
  ".-": "Int -> Int"
  ".*": "Int -> Int"
  "./": "Int -> Int"
  ".%": "Int -> Int"
  ".<<": "Int -> Int"
  ".>>": "Int -> Int"
  ".positive": "() -> Int"
  ".negative": "() -> Int"
  ".==": "Int -> Boolean"
  ".!=": "Int -> Boolean"
  ".<": "Int -> Boolean"
  ".>": "Int -> Boolean"
  ".<=": "Int -> Boolean"
  ".>=": "Int -> Boolean"
  ".**": "Int -> Int"
  ".:repr": "String"

exports.DAny = DAny
exports.DBoolean = DBoolean
exports.DInt = DInt
exports.DNothing = DNothing
exports.DString = DString
exports.DSymbol = DSymbol
exports.typemap = typemap
