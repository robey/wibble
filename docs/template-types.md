# template types

## define

```
# explicit type declaration
type Set($A) {
  ...
}

# global or local function may introduce a new $
let wrapSet = (item: $A): Set($A) -> ...
# which is really:
on (item: $A) -> ...
```

so a wildcard can only be introduced:
  - 'on' params
  - 'type' definition

## resolve/bind

- explicit new: `new Set(Int) { ... }`
    - check that explicit type has no missing templates
    - build a new TypeDescriptor based on `Set` with the wildcard filled in on handlers

- message passing fills in the blanks:
    - `wrapSet 3`
    - `($A -> Set($A)) ~ Int`
    - therefore, $A is Int for this call:
        - when running `handlerTypeForMessage` (`canAssignFrom`), resolve $A to be Int and store in wildcard map
        - use wildcard map to resolve rtype (`Set($A)` becomes `Set(Int)`)
        - store wildcard map in coerceType, so the expr compiler can do type checking inside
    - resolves to `Set(Int)`

## how

new typeScope created:
  - new (to introduce "@")
  - 'on' (for any introduced wildcards)

compileType called:
  - building scope for 'on' handler parameters, attached as "guardType" to node
  - marking annotated type for an 'on' handler
