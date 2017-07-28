import { Parser, Span, Token, Tokenizer } from "packrattle";

export enum TokenType {
  UNKNOWN,

  LF,
  LINESPACE,
  COMMENT,

  // Operator TokenType: + - * / % ** == >= <= != < >
  POWER,
  PLUS,
  MINUS,
  MULTIPLY,
  DIVIDE,
  MODULO,
  EQUALS,
  GREATER_EQUALS,
  LESS_EQUALS,
  NOT_EQUALS,
  LESS_THAN,
  GREATER_THAN,

  // syntax: ( ) [ ] { } = : -> ; | , @ $ :=
  OPAREN,
  CPAREN,
  OBRACKET,
  CBRACKET,
  OBRACE,
  CBRACE,
  BIND,
  COLON,
  ARROW,
  SEMICOLON,
  PIPE,
  COMMA,
  AT,
  DOLLAR,
  ASSIGN,

  // reserved words
  IF,
  THEN,
  ELSE,
  REPEAT,
  WHILE,
  DO,
  RETURN,
  BREAK,
  MATCH,
  AND,
  OR,
  NOT,
  NEW,
  AS,
  LET,
  VAR,
  DEF,
  ON,
  TYPE,
  PROVIDE,
  FOR,
  IMPORT,
  FROM,

  SYMBOL,

  // constants
  NOTHING,
  TRUE,
  FALSE,
  NUMBER_BASE2,
  NUMBER_BASE10,
  NUMBER_BASE16,
  STRING,

  IDENTIFIER,
}

export const WHITESPACE = [
  TokenType.LF,
  TokenType.LINESPACE,
  TokenType.COMMENT
];

export const OPERATORS = [
  TokenType.POWER,
  TokenType.PLUS,
  TokenType.MINUS,
  TokenType.MULTIPLY,
  TokenType.DIVIDE,
  TokenType.MODULO,
  TokenType.EQUALS,
  TokenType.GREATER_EQUALS,
  TokenType.LESS_EQUALS,
  TokenType.NOT_EQUALS,
  TokenType.LESS_THAN,
  TokenType.GREATER_THAN
];

export const RESERVED = [
  TokenType.TRUE,
  TokenType.FALSE,
  TokenType.IF,
  TokenType.THEN,
  TokenType.ELSE,
  TokenType.REPEAT,
  TokenType.WHILE,
  TokenType.DO,
  TokenType.RETURN,
  TokenType.BREAK,
  TokenType.MATCH,
  TokenType.AND,
  TokenType.OR,
  TokenType.NOT,
  TokenType.NEW,
  TokenType.AS,
  TokenType.LET,
  TokenType.VAR,
  TokenType.DEF,
  TokenType.ON,
  TokenType.TYPE,
  TokenType.PROVIDE,
  TokenType.FOR,
  TokenType.IMPORT,
  TokenType.FROM
];

export const IDENTIFIER_LIKE = [ TokenType.IDENTIFIER ].concat(RESERVED);

export const tokenizer = new Tokenizer(TokenType, {
  regex: [
    { token: TokenType.NUMBER_BASE2, regex: /0b[01][01_]*/ },
    { token: TokenType.NUMBER_BASE16, regex: /0x[0-9a-fA-F][0-9a-fA-F_]*/ },
    { token: TokenType.NUMBER_BASE10, regex: /[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][-+]?[0-9][0-9_]*)?/ },
    { token: TokenType.STRING, regex: /"(([^"\\]|\\.)*)"/ },

    { token: TokenType.IDENTIFIER, regex: /[A-Za-z][A-Za-z_0-9]*/ },

    // line may be continued with "\"
    { token: TokenType.LF, regex: /\r?\n/ },
    { token: TokenType.LINESPACE, regex: /([ \t]+|\\[ \t]*\n)+/ },
    { token: TokenType.COMMENT, regex: /\#[^\n]*/ },
  ],
  strings: [
    [ "true", TokenType.TRUE ],
    [ "false", TokenType.FALSE ],
    [ "if", TokenType.IF ],
    [ "then", TokenType.THEN ],
    [ "else", TokenType.ELSE ],
    [ "repeat", TokenType.REPEAT ],
    [ "while", TokenType.WHILE ],
    [ "do", TokenType.DO ],
    [ "return", TokenType.RETURN ],
    [ "break", TokenType.BREAK ],
    [ "match", TokenType.MATCH ],
    [ "and", TokenType.AND ],
    [ "or", TokenType.OR ],
    [ "not", TokenType.NOT ],
    [ "new", TokenType.NEW ],
    [ "as", TokenType.AS ],
    [ "let", TokenType.LET ],
    [ "var", TokenType.VAR ],
    [ "def", TokenType.DEF ],
    [ "on", TokenType.ON ],
    [ "type", TokenType.TYPE ],
    [ "provide", TokenType.PROVIDE ],
    [ "for", TokenType.FOR ],
    [ "import", TokenType.IMPORT ],
    [ "from", TokenType.FROM ],
    [ "()", TokenType.NOTHING ],
    [ "**", TokenType.POWER ],
    [ "+", TokenType.PLUS ],
    [ "->", TokenType.ARROW ],
    [ "-", TokenType.MINUS ],
    [ "*", TokenType.MULTIPLY ],
    [ "/", TokenType.DIVIDE ],
    [ "%", TokenType.MODULO ],
    [ "==", TokenType.EQUALS ],
    [ ">=", TokenType.GREATER_EQUALS ],
    [ "<=", TokenType.LESS_EQUALS ],
    [ "!=", TokenType.NOT_EQUALS ],
    [ "<", TokenType.LESS_THAN ],
    [ ">", TokenType.GREATER_THAN ],
    [ ":=", TokenType.ASSIGN ],
    [ ".", TokenType.SYMBOL ],
    [ "(", TokenType.OPAREN ],
    [ ")", TokenType.CPAREN ],
    [ "[", TokenType.OBRACKET ],
    [ "]", TokenType.CBRACKET ],
    [ "{", TokenType.OBRACE ],
    [ "}", TokenType.CBRACE ],
    [ "=", TokenType.BIND ],
    [ ":", TokenType.COLON ],
    [ ";", TokenType.SEMICOLON ],
    [ "|", TokenType.PIPE ],
    [ ",", TokenType.COMMA ],
    [ "@", TokenType.AT ],
    [ "$", TokenType.DOLLAR ]
  ],
  fallback: TokenType.UNKNOWN
});

// make a token generator for each string type
export const makeToken: { [id: number]: (index: number) => Token } = {};
(tokenizer.rules.strings || []).forEach(([ value, type ]) => {
  makeToken[type] = (index: number) => tokenizer.token(type, new Span(index, index), value);
});
