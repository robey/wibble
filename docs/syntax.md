
## constants

    constant := "()" | "true" | "false" | number | string | symbol | arrayConstant | mapConstant

    number := numberBase2 | numberBase16 | numberBase10

    numberBase2 := "0b" [01]+ "L"?

    numberBase16 := "0x" [0-9a-fA-F]+ "L"?

    numberBase10 := "-"? [0-9]+ ("." [0-9]+)? "L"?

    string := "\"" ([^"\\] | "\\" [.])* "\""

    symbol := ":"? [a-z] [a-zA-Z0-9_]*

    arrayConstant := "[" (ws* constant ws* ","?)* ws* "]"

    mapConstant := "{" (ws* symbol ws* ":" ws* constant ws* ","?)* ws* "}"

