
## common

    SYMBOL_NAME := [a-z] [a-zA-Z0-9_]*

    TYPE_NAME := [A-Z] [a-zA-Z0-9_]*

## constants

    constant := "()" | "true" | "false" | number | string | symbol | opref

    number := numberBase2 | numberBase16 | numberBase10

    numberBase2 := "0b" [01_]+

    numberBase16 := "0x" [0-9a-fA-F_]+

    numberBase10 := [0-9_]+ ("." [0-9_]+)? ([eE] [-+]? [0-9_]+)?

    string := "\"" ([^"\\] | "\\" [.])* "\""

    symbol := "." (SYMBOL_NAME | operator) | ":" SYMBOL_NAME

## expressions

    expression := condition | loop | logical

    condition := "if" expression "then" expression ("else" expression)?

    loop := rawLoop | whileLoop

    rawLoop := "forever" expression

    whileLoop := "while" expression "do" expression

    logical := comparison (("and" | "or") comparison)*

    comparison := term (("==" | ">=" | "<=" | "!=" | "<" | ">") term)*

    term := factor (("+" | "-") factor)*

    factor := power (("\*" | "/" | "%") power)*

    power := call ("\*\*" call)*

    call := unary (ws* atom)*

    unary := ("-" | "not") atom

    atom := constant | reference | array | struct | function | codeBlock | new

    reference := SYMBOL_NAME

    array := "[" (expression ","?)* "]"

    struct := "(" (structMember ","?)* ")"

    structMember := (SYMBOL_NAME "=")? expression

    function := compoundType? (":" typedecl)? "->" expression

    codeBlock := "{" (code ";"?)* "}"

    new := "new" codeBlock

## typedecl

    typedecl := functionType ("|" functionType)*

    functionType := (componentType "->" componentType) | componentType

    componentType := nestedType | parameterType | templateType | simpleType | compoundType

    nestedType := "(" typedecl ")"

    parameterType := "$" TYPE_NAME

    templateType := TYPE_NAME "(" (typedecl ","?)* ")"

    simpleType := "@" | TYPE_NAME

    compoundType := "(" (typedField ","?)* ")"

    typedField := SYMBOL_NAME (":" typedecl)? ("=" expression)?

## code

    code := localVal | assignment | return | handler | expression

    localVal := ("mutable")? SYMBOL_NAME "=" expression

    assignment := SYMBOL_NAME ":=" expression

    return := "return" expression

    handler := "on" (symbol | parameterList) "->" expression
