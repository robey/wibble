
# things that can be in the AST

## constants

    { nothing: true }
    { boolean: true/false }
    { number: base2/base10/base16/long-base2/long-base10/long-base16/real/long-real, value: "" }
    { string: "" }
    { symbol: "" }
    { array: [ const* ] }
    { map: [ [ const, const ]* ] }
