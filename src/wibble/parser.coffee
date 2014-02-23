p_code = require './parser/p_code'
p_common = require './parser/p_common'
p_expr = require './parser/p_expr'
p_type = require './parser/p_type'

exports.code = p_code.code
exports.expression = p_expr.expression
exports.typedecl = p_type.typedecl
exports.whitespace = p_common.whitespace
