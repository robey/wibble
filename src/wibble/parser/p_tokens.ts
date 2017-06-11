import { makeTokenizer, Parser, Token } from "packrattle";

export enum Tokens {
  UNKNOWN,

  // Operator tokens: + - * / % ** == >= <= != < >
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

  // Operator tokens: ( ) [ ] { } = : -> ; | .
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

export const OPERATORS = [
  Tokens.POWER,
  Tokens.PLUS,
  Tokens.MINUS,
  Tokens.MULTIPLY,
  Tokens.DIVIDE,
  Tokens.MODULO,
  Tokens.EQUALS,
  Tokens.GREATER_EQUALS,
  Tokens.LESS_EQUALS,
  Tokens.NOT_EQUALS,
  Tokens.LESS_THAN,
  Tokens.GREATER_THAN
];

export const tokenizer = makeTokenizer({
  tokens: Tokens,
  regex: [
    { token: Tokens.NUMBER_BASE2, regex: /0b[01][01_]*/ },
    { token: Tokens.NUMBER_BASE16, regex: /0x[0-9a-fA-F][0-9a-fA-F_]*/ },
    { token: Tokens.NUMBER_BASE10, regex: /[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][-+]?[0-9][0-9_]*)?/ },
    { token: Tokens.STRING, regex: /"(([^"\\]|\\.)*)"/ },

    { token: Tokens.IDENTIFIER, regex: /[a-z][A-Za-z_0-9]*/ },


  ],
  strings: [
    [ "true", Tokens.TRUE ],
    [ "false", Tokens.FALSE ],
    [ "()", Tokens.NOTHING ],
    [ "**", Tokens.POWER ],
    [ "+", Tokens.PLUS ],
    [ "-", Tokens.MINUS ],
    [ "*", Tokens.MULTIPLY ],
    [ "/", Tokens.DIVIDE ],
    [ "%", Tokens.MODULO ],
    [ "==", Tokens.EQUALS ],
    [ ">=", Tokens.GREATER_EQUALS ],
    [ "<=", Tokens.LESS_EQUALS ],
    [ "!=", Tokens.NOT_EQUALS ],
    [ "<", Tokens.LESS_THAN ],
    [ ">", Tokens.GREATER_THAN ],
    [ ".", Tokens.SYMBOL ],
  ],
  fallback: Tokens.UNKNOWN
});
