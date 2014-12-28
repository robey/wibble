
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

    symbol := "." (SYMBOL_NAME | operator) | ":" SYMBOL_NAME

## expressions

    expression := baseExpression ("unless" expression | "until" expression)?

    baseExpression := condition | loop | logical

    condition := "if" expression "then" expression ("else" expression)?

    loop := rawLoop | whileLoop

    rawLoop := "loop" expression

    whileLoop := "while" expression "do" expression
    
    logical := comparison (("and" | "or") comparison)*

    comparison := shifty (("==" | ">=" | "<=" | "!=" | "<" | ">") shifty)*

    shifty := term (("<<" | ">>") term)*

    term := factor (("+" | "-") factor)*

    factor := power (("*" | "/" | "%") power)*

    power := call ("**" call)*

    call := unary (ws* atom)*

    unary := ("+" | "-" | "not") atom

    atom := constant | reference | array | struct | function | codeBlock | new

    reference := SYMBOL_NAME
    
    array := "[" (expression ","?)* "]"

    struct := "(" (structMember ","?)* ")"

    structMember := (SYMBOL_NAME "=")? expression

    function := compoundType? (":" typedecl)? "->" expression

    codeBlock := "{" (code ";"?)* "}"

    new := "new" codeBlock

## typedecl

    typedecl := componentType ("|" componentType)*

    componentType := nestedType | parameterType | templateType | simpleType | compoundType | functionType

    nestedType := "(" typedecl ")"

    parameterType := "$" TYPE_NAME

    templateType := TYPE_NAME "(" (typedecl ","?)* ")"

    simpleType := "@" | TYPE_NAME

    compoundType := "(" (namedType ","?)* ")"

    namedType := SYMBOL_NAME (":" typedecl)? ("=" expression)?

    functionType := typedecl "->" typedecl

## code

    code := localVal | handler | expression

    localVal := SYMBOL_NAME "=" expression

    handler := "on" (symbol | parameterList) "->" expression

