
# things that can be in the AST

- all nodes have:
  - description (for debugging)
  - span (from packrattle)
  - children[]
  - precedence (lower is higher)
- optionally:
  - comment
  - trailingComment

- a few nodes have a "scope" field, meaning they open a new lexical scope. scope is (name -> CReference).
- "on" nodes will grow a "computedType" field to hold the descriptor of the object being created.
- "on" nodes will grow an "coerceType" if they had a type annotation.

X = eliminated by transformations

## constants

  - PConstant(type, value)
    - PConstantType: NOTHING, BOOLEAN, SYMBOL, NUMBER_BASE10, NUMBER_BASE16, NUMBER_BASE2, STRING

## expressions

  - PExpr(description, span, children, comment, trailingComment)
    - PReference(name)
    - PArray
    - X: PFunction(inType, outType)
    - PStruct
      - PStructField(name)
    - PNew  [scope, newType]
    - X: PUnary(op)
    - PCall  [coerceType]
    - X: PBinary(op)
    - PLogic(op)
    - PAssignment
    - PIf
    - PRepeat
    - X: PWhile
    - PReturn
    - PBreak

## code

  - PLocal(name, mutable)
  - PLocals(mutable)
  - POn  [scope, coerceType, computedType]
  - PBlock  [scope]

## types

  - PType(description, span, children)
    - PSimpleType(name)
    - PCompoundType
      - PTypedField(name, type, defaultValue, span)
    - PTemplateType(name)
    - PParameterType(name)
    - PFunctionType(argType, resultType)
    - PMergedType


# Type descriptors

  - TypeDescriptor
    - CompoundType(fields)
      - CTypedField(name, type, defaultValue)
    - MergedType(types)




# AST type objects

- TypeDescriptor (generic)
- NamedType ("Foo")
- ParameterType ("$A")
- SelfType ("@", with link to the actual type)
- CompoundType ("(x: Int, y: Int)" -- structs)
- UserType (user-defined objects and functions, matched by prototypes)
- DisjointType ("Int | String")
