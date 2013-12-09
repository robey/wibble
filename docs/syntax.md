
## common

    SYMBOL_NAME := [a-z] [a-zA-Z0-9_]*

    TYPE_NAME := [A-Z] [a-zA-Z0-9_]*

## constants

    constant := "()" | "true" | "false" | number | string | symbol | opref

    number := numberBase2 | numberBase16 | numberBase10

    numberBase2 := "0b" [01]+ "L"?

    numberBase16 := "0x" [0-9a-fA-F]+ "L"?

    numberBase10 := "-"? [0-9]+ ("." [0-9]+)? "L"?

    string := "\"" ([^"\\] | "\\" [.])* "\""

    symbol := "'"? SYMBOL_NAME

    opref := "'" operator

## expressions

    expression := condition | logical

    condition := "if" ws* expression ws* "then" ws* expression (ws* "else" ws* expression)?

    logical := comparison (("and" | "or") comparison)*

    comparison := shifty (("==" | ">=" | "<=" | "!=" | "<" | ">") shifty)*

    shifty := term (("<<" | ">>") term)*

    term := factor (("+" | "-") factor)*

    factor := power (("*" | "/" | "%") power)*

    power := call ("**" call)*

    call := unary (ws* atom)*

    unary := ("-" | "not") atom

    atom := constant | array | map | struct | function

    array := "[" (ws* expression ws* ","?)* ws* "]"

    map := "{" (ws* expression ws* ":" ws* expression ws* ","?)* ws* "}"

    struct := "(" (ws* structMember ws* ","?)* ws* ")"

    structMember := (SYMBOL_NAME ws* "=" ws*)? expression

    function := parameterList? ws* "->" ws* expression

    parameterList := "(" (ws* parameter ws* ","?)* ")"

    parameter := SYMBOL_NAME (ws? ":" ws* typedecl)? (ws* "=" ws* expression)?

## typedecl

    typedecl := templateType | simpleType | compoundType | functionType

    templateType := TYPE_NAME "(" (ws* typedecl ws* ","?)* ")"

    simpleType := "@" | TYPE_NAME

    compoundType := "(" (ws* namedType ws* ","?)* ")"

    namedType := (SYMBOL_NAME ws* ":" ws*)? typedecl

    functionType := typedecl ws* "->" ws* typedecl

## code

    code := localVal | expression

    localVal := "val" ws* SYMBOL_NAME ws* "=" ws* expression

