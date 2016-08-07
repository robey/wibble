```
call
|-new
| newType=(f: Int -> Int) -> [unresolved 103 -> depends on none: f 2 / scope=Scope(f → Scope())]
| `-on
|   scope=Scope(f → Scope())
|   |-compoundType
|   | `-field(f)
|   |   `-functionType
|   |     |-type(Int)
|   |     `-type(Int)
|   `-call
|     |-f
|     `-const(NUMBER_BASE10, 2)
`-new
  newType=(x: $A) -> [unresolved 107 -> depends on none: x .+ 1 / scope=Scope(x → Scope())]
  `-on
    scope=Scope(x → Scope())
    |-compoundType
    | `-field(x)
    |   `-parameterType(A)
    `-call
      |-call
      | |-x
      | `-const(SYMBOL, +)
      `-const(NUMBER_BASE10, 1)
```

- how to determine that ($A -> ??) is compatible with (Int -> Int)
    - type on right needs to be fully defined, if possible?
    - what if it depends on another type? need to follow the tree down, if possible
