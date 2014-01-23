
# things that can be in the AST

X = eliminated by transformations

everything has a "state" field.

## constants

    { nothing: true }
    { boolean: true/false }
    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    { symbol: "" }
    { string: "" }

## expressions

    { reference: "" }
    { array: [ expr* ] }
    { struct: [ { name?, expression: expr }* ] }
    X: { unary: "+"/"-"/"not", right: expr }
    { call: expr, arg: expr }
    X: { binary: (op), left: expr, right: expr }
    { condition: expr, ifThen: expr, ifElse: expr }
    X: { functionx: expr, parameters: { name, type, value: expr }* }
    { newObject: code }

## types

    { typename: string }
    { namedType: type, name: string }
    { compoundType: (type | namedType)* }
    { functionType: type, argType: type }
    { templateType: string, parameters: type* }

## code

    { local: { name }, value: expr }
    { on: { symbol | parameters }, handler: expr }
    { code: [ expr* ] }
