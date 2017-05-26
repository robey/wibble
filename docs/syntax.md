
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

    symbol := "." (SYMBOL_NAME | operator)

## expressions

    expression := condition | loop | return | break | function | match

    condition := "if" expression "then" expression ("else" expression)?

    loop := repeatLoop | whileLoop

    repeatLoop := "repeat" expression

    whileLoop := "while" expression "do" expression

    return := "return" expression

    break := "break" expression?

    match := logical ("match" "{" matchExpr* "}")?

    logical := logicalAnd ("or" logicalAnd)*

    logicalAnd := comparison ("and" comparison)*

    comparison := term (("==" | ">=" | "<=" | "!=" | "<" | ">") term)*

    term := factor (("+" | "-") factor)*

    factor := power (("\*" | "/" | "%") power)*

    power := call ("\*\*" call)*

    call := unary (ws* atom)*

    unary := ("-" | "not") atom ("as" typedecl)?

    atom := constant | reference | array | struct | codeBlock | new

    reference := SYMBOL_NAME

    array := "[" (expression ","?)* "]"

    struct := "(" (structMember ","?)* ")"

    structMember := (SYMBOL_NAME "=")? expression

    function := (compoundType (":" typedecl)?)? "->" expression

    codeBlock := "{" (code ";"?)* "}"

    new := "new" typedecl? codeBlock

    matchExpr := XXX FIXME XXX

## typedecl

    typedecl := functionType ("|" functionType)*

    functionType := (componentType "->" componentType) | componentType

    componentType := inlineType | nestedType | parameterType | templateType | simpleType | compoundType

    inlineType := "{" descriptor ( [;\n] descriptor )* "}"

    descriptor := (symbol | compoundType) "->" typedecl

    nestedType := "(" typedecl ")"

    parameterType := "$" TYPE_NAME

    templateType := TYPE_NAME "(" typedecl ("," typedecl)* ")"

    simpleType := "@" | TYPE_NAME

    compoundType := "(" (typedField ("," typedField)\*)? ")"

    typedField := SYMBOL_NAME (":" typedecl)? ("=" expression)?

## code

    code := localLet | localDef | assignment | handler | expression

    localLet := "let" [ "var" ] SYMBOL_NAME "=" expression ("," [ "var" ] SYMBOL_NAME "=" expression)*

    # sugar for let A = B (":" C)? -> D
    localDef := "def" SYMBOL_NAME compoundType (":" typedecl)? codeBlock

    assignment := SYMBOL_NAME ":=" expression

    handler := "on" (symbol | parameterList) "->" expression

## body

    body := createType | createProvide | localDef

    createType := "type" typedef (":" (typedef ","?)+)? "{" typeField* "}"

    createProvide := "provide" typedef "for" typedef "{" provideField* "}""

    typedef := SYMBOL_NAME ("(" parameterType ("," parameterType)\* ")")?

    typeField := SYMBOL_NAME compoundType? codeBlock?

    provideField := SYMBOL_NAME compoundType? codeBlock

## module

    module := import* body*

    import := "import" importName (("," importName)* "from" SYMBOL_NAME)?

    importName := SYMBOL_NAME ("as" SYMBOL_NAME)
