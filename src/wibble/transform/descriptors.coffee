util = require 'util'
t_type = require './t_type'
t_scope = require './t_scope'

DAny = new t_type.NamedType("Any")
DAny.canCoerceFrom = (other) -> true

DBoolean = new t_type.NamedType("Boolean")
DInt = new t_type.NamedType("Int")
DNothing = new t_type.NamedType("Nothing")
DString = new t_type.NamedType("String")
DSymbol = new t_type.NamedType("Symbol")

typemap = new t_scope.Scope()
typemap.add DAny.name, DAny
typemap.add DBoolean.name, DBoolean
typemap.add DInt.name, DInt
typemap.add DNothing.name, DNothing
typemap.add DString.name, DString
typemap.add DSymbol.name, DSymbol

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

t_type.addHandlers DString, typemap,
  ".size": "Int"

exports.DAny = DAny
exports.DBoolean = DBoolean
exports.DInt = DInt
exports.DNothing = DNothing
exports.DString = DString
exports.DSymbol = DSymbol
exports.typemap = typemap
