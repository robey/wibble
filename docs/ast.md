
# things that can be in the AST

X = eliminated by transformations

- everything has a "state" field.
- a few nodes have a "scope" field, meaning they open a new lexical scope.
  scope is (name -> type).
- a few nodes will grow a "type" field to hold the descriptor of the object
  being created.

## constants

    { nothing: true }
    { boolean: true/false }
    { number: base2/base10/base16/long-base2/long-base10/long-base16/float/long-float, value: "" }
    { symbol: "" }
    { string: "" }

## expressions 

    { reference: "" }
    { array: [ expr* ] }
    { struct: [ { name: string?, [type], value: expr }* ], [type] }
    X: { unary: "+"/"-"/"not", right: expr }
    { call: expr, arg: expr }
    X: { binary: (op), left: expr, right: expr }
    { logic: "and"/"or", left: expr, right: expr }
    { condition: expr, ifThen: expr, ifElse: expr }
    X: { functionx: expr, parameters: compoundType, type? }
    { newObject: code, stateless: bool }
    X: { unless: expr, nested: expr }

## code

    { local: { name: string }, value: expr, mutable: bool }
    { on: { symbol | compoundType }, handler: expr, type?, [scope] }
    { code: [ expr* ], [scope] }

## types

    { typename: string }
    { compoundType: { name: string, type: type, value: expr }* }
    { functionType: type, argType: type }
    { parameterType: string }
    { templateType: string, parameters: type* }
    { disjointType: type* }

# AST type objects

- TypeDescriptor (generic)
- NamedType ("Foo")
- ParameterType ("$A")
- SelfType ("@", with link to the actual type)
- CompoundType ("(x: Int, y: Int)" -- structs)
- UserType (user-defined objects and functions, matched by prototypes)
- DisjointType ("Int | String")
