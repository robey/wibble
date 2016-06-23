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

## resolve/bind

- explicit new: `new Set(Int) { ... }`
    - check that explicit type has no missing templates

- message passing fills in the blanks:
    - `wrapSet 3`
    - `($A -> Set($A)) ~ Int`
    - therefore, $A is Int for this call:
        - add to type scope and resolve nestedly if necessary
    - resolves to `Set(Int)`
