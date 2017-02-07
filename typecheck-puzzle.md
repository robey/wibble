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
    - right type must be:
        - new on
    - left type must be:
        - one handler only
        - that handler is a guard type
        - that guard type is, itself, a function (a type with one handler)


```
block
scope=Scope(withX, x → Scope())
|-let
| `-local(x)
|   `-const(NUMBER_BASE10, 30)
|-let
| `-local(withX)
|   `-new
|     newType=(f: Int -> Int) -> [unresolved 109 -> depends on 104: f x / scope=Scope(f → Scope(withX, x → Scope())) typeScope=Scope( → Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol)))]
|     `-on
|       scope=Scope(f → Scope(withX, x → Scope()))
|       |-compoundType
|       | `-field(f)
|       |   `-functionType
|       |     |-type(Int)
|       |     `-type(Int)
|       `-call
|         |-f
|         `-x
`-call
  |-withX
  `-new
    newType=(x: $A) -> [unresolved 113 -> depends on none: x .+ 1 / scope=Scope(x → Scope(withX, x → Scope())) typeScope=Scope($A → Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol)))]
    `-on
      scope=Scope(x → Scope(withX, x → Scope()))
      |-compoundType
      | `-field(x)
      |   `-parameterType(A)
      `-call
        |-call
        | |-x
        | `-const(SYMBOL, +)
        `-const(NUMBER_BASE10, 1)
try to resolve:
  [unresolved 104 -> depends on none: 30 / scope=Scope(withX, x → Scope()) typeScope=Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol))]
  [unresolved 105 -> depends on 109: new (on (f: Int -> Int) -> f x) / scope=Scope(withX, x → Scope()) typeScope=Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol))]
  [unresolved 109 -> depends on 104: f x / scope=Scope(f → Scope(withX, x → Scope())) typeScope=Scope( → Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol)))]
  [unresolved 113 -> depends on none: x .+ 1 / scope=Scope(x → Scope(withX, x → Scope())) typeScope=Scope($A → Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol)))]
  [unresolved 114 -> depends on none: withX / scope=Scope(withX, x → Scope()) typeScope=Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol))]
  [unresolved 115 -> depends on 114: new (on (x: $A) -> x .+ 1) / scope=Scope(withX, x → Scope()) typeScope=Scope( → Scope(Anything, Array, Boolean, Int, Nothing, String, Symbol))]
```
