
# things that can be in the AST

X = eliminated by transformations

## constants

    { nothing: true }
    { boolean: true/false }
    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    { string: "" }
    { symbol: "" }

## expressions

    { reference: "" }
    { array: [ expr* ] }
    { struct: [ { name?, expression: expr }* ] }
    X: { unary: "+"/"-"/"not", right: expr }
    { call: expr, arg: expr }
    X: { binary: (op), left: expr, right: expr }
    { condition: expr, ifThen: expr, ifElse: expr }
    { functionx: expr, parameters: { name, type, value: expr }* }

## types

    { type: string }
    { namedType: type, name: string }
    { compoundType: type* }
    { functionType: type, argType: type }
    { templateType: string, parameters: type* }

## code

    { local, value: expr }
    { code: [ expr* ] }
