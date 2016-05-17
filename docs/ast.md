
# things that can be in the AST

- all nodes have:
  - description (for debugging)
  - span (from packrattle)
  - children[]
- optionally:
  - comment
  - trailingComment

X = eliminated by transformations

- a few nodes have a "scope" field, meaning they open a new lexical scope.
  scope is (name -> type).
- a few nodes will grow a "type" field to hold the descriptor of the object
  being created.

## constants

  - PConstant(type, value)
    - PConstantType: NOTHING, BOOLEAN, SYMBOL, NUMBER_BASE10, NUMBER_BASE16, NUMBER_BASE2, STRING

## expressions

  - PExpr(description, span, children, comment, trailingComment)
    - PReference(name)
    - PArray
    - PFunction(inType, outType)
    - PStruct
      - PStructField(name)
    - PNew
    - PUnary(op)
    - PCall
    - PBinary(op)
    - PAssignment
    - PIf
    - PRepeat
    - PWhile
    - PReturn
    - PBreak



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

  - PLocal
  - PLocals(mutable)
  - POn
  - PBlock

    { local: { name: string }, value: expr, mutable: bool }
    { assignment: string, value: expr }
    { on: { symbol | compoundType }, handler: expr, type?, [scope] }
    { returnEarly: expr }
    { code: [ expr* ], [scope] }

## types

  - PType(description, span, children)
    - PSimpleType(name)
    - PCompoundType
      - PTypedField(name, type, defaultValue, span)
    - PTemplateType(name)
    - PParameterType(name)
    - PFunctionType(argType, resultType)
    - PDisjointType


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
