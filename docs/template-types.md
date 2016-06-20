# template types

## define

```
# explicit type declaration
type Set($A) {
  ...
}

# global or local function may introduce a new $
let wrapSet = (item: $A): Set($A) -> ...
```

## resolve

- explicit new: `new Set(Int) { ... }`

- message passing fills in the blanks:
    - `wrapSet 3`
    - `($A -> Set($A)) ~ Int`
    - therefore, $A is Int for this call
    - resolves to `Set(Int)`
    
