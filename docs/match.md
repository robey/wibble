# how will "match" work?

```
user match {
  (name="Fred", age, books) -> books
  3 -> 3
  (name="Rob", age, books) if age > 18 -> books
  x: BookType -> x.books
  -> 4
}
```

## things that can be on the left side

- constant
- wildcard, match anything else (nothing on left)
- type matching (local ":" Type)
- conditional (append: "if" expr)
- destructure array?
- destructure record
