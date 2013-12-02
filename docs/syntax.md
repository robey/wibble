
## common

    SYMBOL_NAME := [a-z] [a-zA-Z0-9_]*

## constants

    constant := "()" | "true" | "false" | number | string | symbol | opref

    number := numberBase2 | numberBase16 | numberBase10

    numberBase2 := "0b" [01]+ "L"?

    numberBase16 := "0x" [0-9a-fA-F]+ "L"?

    numberBase10 := "-"? [0-9]+ ("." [0-9]+)? "L"?

    string := "\"" ([^"\\] | "\\" [.])* "\""

    symbol := ":"? SYMBOL_NAME

    opref := ":" operator

## expressions

    unary := ("-" | "not") atom

    atom := constant | array | map | struct

    array := "[" (ws* expression ws* ","?)* ws* "]"

    map := "{" (ws* expression ws* ":" ws* expression ws* ","?)* ws* "}"

    struct := "(" (ws* structMember ws* ","?)* ws* ")"

    structMember := (SYMBOL_NAME ws* "=" ws*)? expression

