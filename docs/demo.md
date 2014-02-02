
# wibble so far

This is a quick-reference description of the parts of wibble that are implemented in the jsrepl demo so far.

## Constants

The "nothing" value is called `Nothing` and is just an empty set of parens.

    ()

Integers are type `Int` and infinite-precision.

    23, 0, -123, 9876543210123456789

Symbols are a word or operator that start with `.`.

    .hello, .get, .+

Records are name/value sets (immutable). The order doesn't matter.

    (x = 10, y = 20)
    (direction = .north, speed = 100, acceleration = 5)

## Assignment

The `val` keyword assigns variables. In the jsrepl, they usually enter the global namespace, which you can view with `/globals`.

    val x = 1
    val point = (x=1, y=2)

## Code blocks

Code blocks are in curly braces. They open a new lexical scope of local variables, but are otherwise treated as a compound expression. The return value of a code block is the return value of the last expression to run. The different expressions inside can be separated by semicolons or linefeeds.

    { val a = 3; a + 4 }

## Messages

Interactions are done by sending messages, similar to smalltalk. Messages are sent by putting one expression next to another one.

    cat .pet  # send (.pet) to (cat)

For example, you can send a field name to a record, and it will return that field.

    (x=10, y=20) .x  # -> 10

## Math

Binary math operations work. After resolving precedence, they're converted to messages, so

    10 + 9

turns into

    (10 .+) 9

The left side `10 .+` sends the `+` message to 10, which returns a function that adds 10 to things. Sending 9 to this function will add 10 to 9, giving you 19. Math!

## Functions

Functions take one object and return another, but either the argument or the return value may be a record, so you can emulate functions that take many arguments or return many values.

Functions are defined by an optional argument description followed by an arrow (`->`) followed by an expression.

    val add = (a: Int, b: Int) -> a + b
    add (3, 4)  # -> 7

When a function argument is a record, the fields may be explicitly named and reordered, or given default values.

    val sub = (total: Int, without: Int = 1) -> total - without
    sub(100, 5)  # -> 95
    sub(100)  # -> 99
    sub 100   # -> 99
    sub(without=9, total=20)  # -> 11

## Objects

An object is created by `new`. It must have at least one message handler, so it can respond to messages.

    val obj = new { on .get -> 8 }
    obj .get  # -> 8

A message handler:

    on <symbol | declaration> -> <expression>

can respond to a symbol constant, or a declaration that will match a type.

    val addTen = new { on (n: Int) -> n + 10 }
    addTen 3  # -> 13

A function is just syntactic sugar for an object that can only receive one message type.
