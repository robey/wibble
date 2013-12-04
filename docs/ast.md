
# things that can be in the AST

## constants

    { nothing: true }
    { boolean: true/false }
    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    { string: "" }
    { symbol: "" }

## expressions

    { array: [ expr* ] }
    { map: [ [ expr, expr ]* ] }
    { struct: [ { name?, expression: expr }* ] }
    { unary: "+"/"-"/"not", right: expr }
    { call: expr, arg: expr }
    { binary: (op), left: expr, right: expr }
    { condition: expr, ifThen: expr, ifElse: expr }
    