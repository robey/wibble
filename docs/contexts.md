
# contexts

roanoke, va -- 6 june 2012

i had an upsight last night: i think it's a really cool property of languages like lisp that most of the language can be built on top of a few simple features. so i was thinking about the distinctions between a function and an object, and why i was having trouble figuring out which should be implemented in terms of the other.

already i wanted to make the base type be a "thing that can receive messages", but that was just an implementation detail. last night i realized that the "thing that can receive messages" should be the *main* implementation, and function and object should be built on top of that.

so: each code block of `{ ... }` should create a new context: a new set of local variables. it should also be able to receive messages, and there should be syntax for letting a context say that it can handle a certain type of message, and run some code in that case. something like:

    {
      x = 3
      on create { ... }
    }

the code block is an "object" of sorts. it has a field "x", which is a local variable, and it can do something when it receives the "create" message. a function for computing the hypotenuse distance could then be:

    @distance = {
      on (x: Int, y: Int) { ((x * x) + (y * y)) ** 0.5 }
    }

it's an object that can receive a single type of message: a struct with int "x" and int "y". the syntax of

    @distance = (x: Int, y: Int) => ((x * x) + (y * y)) ** 0.5

could just be sugar for the object creation. so could

    def distance(x: Int, y: Int) = ((x * x) + (y * y)) ** 0.5

the python-style class, where the class is really a function that creates new objects, falls out too:

    Point = {
      # this is the constructor:
      on (x: Int, y: Int) {
        {
          @x = x
          @y = y
          def distance = ((@x * @x) + (@y * @y)) ** 0.5
        }
      }
    }

and could be sugar'd to

    type Point(@x: Int, @y: Int) {
      def distance = ((@x * @x) + (@y * @y)) ** 0.5
    }


# receiving messages

a context matches an incoming message by:

- value (an equality check), or
- struct type (any value of a type "compatible" to this)

each handler points to code to execute.

if it's not a value, the type must be a struct type so that the fields can be bound into the code body as locals. allowing a simple type like "Int" raises the question of: how do i access this int from inside the handler? it also creates an ambiguity between a struct that contains only one int versus a bare int type, because of the sugar that allows you to send a message of a single int to a function that requires only one int as a parameter (instead of making you build a single-element struct).


# traits and prototypes

(12 july 2012)

a trait is a set of message types that are understood by an object, and the
types returned by those messages.

    trait Stream {
      close: -> Unit
      write: (data: Buffer) -> Int
    }

a prototype is a trait definition that generates objects fitting that trait.
the objects can have state. effectively, the prototype is a function that,
when called, executes the attached code and returns an object with that state.

    prototype Point(@x: Int, @y: Int) {
      val distance = ((@x * @x) + (@y * @y)) ** 0.5
      def distanceTo(p: Point) = { ... }
    }

this creates the trait Point, and a function Point that can be used to create
the objects.

    Point(3, 4)
    => object of type Point


# state and behavior

las vegas -- 28 july 2012

an object really has two components:

- state
- behavior

the state of an object is really just a set of key/value pairs: string names
associated with values. so an object state is also basically the same thing
as a lexical scope. a scope is just a map of string names to types and
current values.

behavior is the set of functions on the object, or in the case of wibble, the
messages it receives.

in an OO system, the state and behavior would both be defined by the object's
class, and its parent classes. in wibble, i believe an object's state should
be localized to the object. it can inherit a default set of name/type/values
from a prototype, but each object really has its own.

access to an object's state should always be limited to that object, but by
default each state field should have an accessor in the behavior.

the real question is how to sort all this out so that it's clear (when
writing a prototype) what's being referenced. it seems like the following
things are frequently allowed as "visible" in the lexical scope of a piece
of code in a method on a class:

- local variables defined in this lexical scope
- local variables defined in an outer scope, up to the level of the method
  definition (but not beyond)
- state variables on the object (`this.foo` sometimes)
- global variables (also where types are stored)

i like the ruby/coffeescript style of prefixing this-object (self-object)
references with "@". coffeescript makes methods available this way, too,
but i'm not sure it's a good idea to conflate access on the state with
lookups on the behavior.

it would be nice if there was a way to distinguish all of these accesses:

- local variables
- "this"/"self"
- state variables
- global variables


# mutable variables

after reading part of this:

http://www.flyingmachinestudios.com/programming/the-unofficial-guide-to-rich-hickeys-brain/

i was suddenly hit with the idea that maybe the "mutable variables" problem
can be solved by declaring that only locals can be mutable.

so, fields in objects are always immutable, making objects immutable as a
whole. but local vars can be reassigned. should that be true also of globals?


# creating objects

pahala -- 6 mar 2013

if an object is immutable, then the difference between a struct and a "true
object" goes away. any object should have a default "toString" debug output,
then, and have standard accessors.

the in-memory format should be something like c++: a packed vector of fields,
preceded by a pointer to the object's description ("manifest").

so a syntax for creating an anonymous object might be:

    object {
      val name = "Robey"
      def moveTo(place: Location) = { ... }

      log "created object."
    }

anything inside { } creates a "scope" or "code block": a set of local
variables ("name" and "moveTo" here) and maybe some code too, like the call to
"log". "object" is a global/builtin that creates an object when given a code
block. the code block is executed by "object", and then the final values of
all the local variables become the state of the object.

objects should have useful handlers on them by default, for things like
"toString" and "copy" (to create a copy with different values for the fields).
and of course getters.


# dependency hell

okay, stop, regroup, figure out the dependencies so they're not circular.
use "->" to mean directly dependent, "...>" to mean the implementation
depends on having it available.

- WObject ...> WSymbol, WType
- WInt -> WObject ...> WIntType
- WSymbol -> WObject ...> WSymbolType
- WType -> WObject ...> WTypeType


# loops

santa clara -- 31 aug 2013

rus pointed out that you often want to exit a loop in the middle, not just at
the top ("while ... do") or bottom ("do ... while ...").

    loop {
      ...
      done if count > 3
      ...
    }


# immutable objects vs iterators

san francisco -- 16 oct 2013

if objects are immutable, then how can you have iterators? java/scala has the
concept of an "iterable", which is any object that can produce an iterator. so
far, so good, but the iterator object itself must keep state: when you call
"next" on the same iterator twice, you should get two consecutive elements. it
has to remember its place.

scala adds more traits: an object can be "traversable", which has only one
core method to implement: "foreach". foreach can be implemented by
collections, using local state only, and all the other methods of
"traversable" (and there are dozens!) can be implemented in terms of foreach.
to handle methods like "take(n)", scala allows the code inside a "foreach"
block to break. (it does this by defining an exception, and each "breakable"
code block creates a new exception object. the outside code catches only that
specific object.)

i like the scala method of avoiding mutable state here. "stream" is mutable,
but apparently just to let it memoize previous values.

it did occur to me that i could add a method modifier "mutable", which would
mark a method as mutating the object state. under the hood, it would just
return the normal result and also a new object to replace your original object
reference. it would therefore only work for local variables. this might not be
necessary, though.


# pipe operator

santa clara -- 28 oct 2013

i still like the "pipe" operator for reversing the order of "apply":

    a ! b  <==>  b a

but i don't know what to use for it. the original `|>` looks ridiculous and is
hard to type. but `!` usually means "send message to actor" and has the
opposite sense ("b" would be sent to "a"). the obvious choice, `|`, means bit
manipulation.

it would be really useful for pattern matching. if any code block with a
"case" in it is a partial function, then a match statement could be just

    result ! {
      case None => ...
      case Some(x) => ...
    }


# generics

las vegas -- 3 nov 2013

any type checking will have to cope with generics. one option is to go back to
c++ syntax with things like "Queue<T>". but two things:

1. i like the "$T" syntax ("Queue<$T>") for the type parameters, because it
calls them out as special. you can glance at some code and see where the
template type is used.

2. could generics be considered just another form of message passing?

for the second point, i'm thinking that type checking is a form of "running
code at compile-time" to catch errors early, so types are really tiny
assertions you're making, which can be checked by the compiler. if that's
true, then any type declaration is a compile-time assertion, so it's code that
runs at compile-time.

a generic, then, could be just a function that generates types. "Queue" isn't
itself a type, it's a type *generator*. the code in Queue is a set of defaults
used once a specific type is created. this is really a lot like c++ templates,
except that the compiler knows what's going on. the Queue generator is
expected to compile cleanly all by itself, even if it's not ever used.

so a generic like Queue is a compile-time generator that accepts a type (which
might be a tuple of types) and returns a type.

    type Queue($T) {
      push: $T -> @
      pop: -> ($T, @)
    }

it could return a trait, too. for a compiled language, this has interesting
quirks, i think. for example, if a shared library defines Queue, the compiled
object code needs to include all the information needed for creating new Queue
types. c++ really fell down there.

looking at the syntax for types, it would let some really weird things be
possible, like

    type Rabbit($A, $B)
    val x = Rabbit(Int -> String, @)

the $A, $B are just blanks, like in mad-libs, for filling in the actual type
later.


# symbols

santa clara -- 6 dec 2013

i'm going to have to give up on using bare words as symbols. it's too
confusing to have a bare word mean "maybe a symbol, or maybe a reference to a
local variable or something from another scope".

i see two possible solutions:

1. prefix all variable references with a piece of linenoise. for example,
"$global", "^local", "@field".

2. prefix symbols with linenoise.

if i do neither, then the following code would do something unexpected:

    val contains = 4
    s contains "cat"

in the best case, it would give a compile-time error about 's' being unable to
receive an int. but probably "string(int)" would return the character at that
position, so it would be an error about the character (string) being unable to
receive another string. a worse case would be if 's' were actually a
collection of functions, or something else able to receive a string.

prefixing variable references seems like it would make code too messy.

    val ^area = ^r * ^r * $PI

i've already played around with changing the symbol prefix (for operators)
from ':' to a single quote ('), and that looked okay, i think. what if i
changed it to dot ('.') and made it mandatory?

    s .contains "cat"

it can mimic the normal "x.foo" syntax, then, which is pretty cool. i could
probably make an exception for symbols that are unambiguous, though rus has
convinced me that this type of infix code isn't really that useful. it matters
more for operators, which i already have a solution for.


# mutable / optional

flight to charlotte -- 18 dec 2013

two random ideas: first, there should be syntactic sugar for marking a type as being optional. these two lines should be equivalent:

    (name: String, nickname: Optional(String)) -> Cat
    (name: String, nickname: String?) -> Cat

second, a global called "mutable" could be a factory for turning a type into a cell for that type.

    val count = mutable 0  # count: Mutable(Int)

wrapping vals in Mutable could be an easy way to allow but discourage mutable variables. it also makes it nicely explicit what's going on: that a cell is being created to hold the value. (it should be fine to optimize away, though.)


# new / on

flight from charlotte -- 26 dec 2013

i've decided that it's overly clever to have any block with an "on" statement turn into a new object with an event handler. it makes it hard to see new objects when they're created, because they look just like other code, with one tiny difference: the presence of a magic statement somewhere in the block.

instead, i think code blocks and new objects should be distinguished by a keyword. to create a new object that's actually a function:

    new {
      on (x: Int) -> x * 2
    }

to group statements into a single expression, bare braces is fine:

    {
      val f = (x: Int) -> x * 2
      f
    }

this implies that the desugared way of defining a method would be:

    type Int {
      on .+ -> new {
        on (n: Int) -> <...>
      }
    }


# binding @

san francisco -- 20 jan 2014

Calling a method on an object is a two-stage process:

    hash.process(imageData)

1. Send message `.process` to `hash`. Returns a function, with `@` bound to
   `hash`.
2. Send message `imageData` to the function. Probably returns a count or a
   final hash result. `@` isn't re-bound.

So a key difference between objects and functions is that when objects receive a message, `@` is bound to the object that actually received the message. When a function receives a message, it leaves `@` alone.

As much as possible, I want to keep the property that most of the language's internals can be written in itself, out of primitives. So I think `@` should not be bound by default. Instead, some builtin function wraps a function by binding `@` to the recipient:

    val bind: ($A -> $B) -> ($A -> $B)

    on .process -> bind (new {
      on (imageData: Buffer) -> <...>
    })

Additionally, I hate the parentheses around the function there, so I think wibble should borrow the `$` operator from Haskell, but maybe use something less weird-looking, like `:`. The precedence-dropping operator would treat everything after it as a single argument.

    on .process -> bind: new {
      on (imageData: Buffer) -> <...>
    }

    on .process -> bind: (imageData: Buffer) -> <...>

Need to think about that a bit, though. `:` might be too ambiguous, for one.


# pattern matching

tahoe -- 2 feb 2014

There's gonna need to be pattern matching, but I'm angsty about how that should work. At the very least, it should:

- be able to replace a chain of if/else or a switch/case
- decompose records and do partial matches
- do trait/type matching

Records are already bothering me a bit, because there are two different syntaxes for them:

    (x = 23, y = 50)  # anonymous constructor
    (x: Int = 23, y: Int) -> ...  # 'on' handler

Pattern matching would create a third.

    (x: Int, ...) -> ...

Okay, actually, those might be the same syntax, now that I typed them out instead of imagining them. Maybe this will be okay. Here's a strawman syntax for pattern matching:

    x match {
      50 -> ... # if x == 50
      (name: String, density: Int, ...) -> ... # pattern match a record
      Symbol -> ... # x is a Symbol
    }


# just-whenever compiling

san ignacio, belize -- 25 mar 2014

There was a pretty hype-filled Wired article on Facebook's "Hack" language a few days ago, but it had one interesting idea worth keeping in mind -- something that isn't even in Hack, I think.

The idea is "just-whenever" compiling: When you first start working on a project, iteration speed is important. It would be nice to avoid the compilation phase whenever possible, and just go into a tight edit/test cycle. This is a common complaint against the scala compiler, which is too slow to keep the feedback cycle tight.

Once you have things working well, you want a separate compile phase to offload as much work as you can before running the code in production. It sorta "pre-optimizes" or "pre-JITs" the code. Combined with static type-checking, it would let you offload a lot of regression testing to the compile phase. Even without type-checking, the compile phase will find some errors that the parser won't.

So this is more fuel for the argument that wibble's compiler should be a library just as much as its runtime. And the runtime must be able to take a raw text file, parse it, compile it, and then run it. I don't know if it makes sense to create an output format for parsed-but-uncompiled code, but it definitely makes sense to create a format for LLVM bitcode with the original source attached.


# swift

santa clara, ca -- 4 jun 2014

Apple just released Swift, a closed-source language to replace Objective-C on iOS devices. It's obviously pretty relevant to wibble:

- They use "->" to declare function return types, so they can't use it for anonymous functions. Instead they have an awkward-looking "\<args> in \<code>" syntax.

- They use "?" for the optional type, so that's obviously not a unique idea.

- They use "$0", "$1", and so on for placeholder fields in an anonymous function, like "reduce { $0 + $1 }". This is a great idea and I should totally steal it.

- I just saw "func sumVec<A, N: Num where N.N == A>" in an example, meaning they probably came up with "where" independently, too. That's somewhat validating. I think in the current wibble drafts, that would look like "def sumVec($A, $N) where { $N is Num; $A is N.N }".


# bartlett GC

san francisco, ca -- 13 jun 2014

This sounds like a good default GC: The "Bartlett method" doesn't attempt to parse the thread stacks, but just pulls out anything that "looks like" a pointer, from the stacks and registers. The ones that point to objects are roots, but the pages referred to by any pointer-like things are treated as "pinned" and no objects on them are moved or collected.

The advantage is that all of the tricky stack-manipulation can go away. LLVM no longer has to be forced to stuff new object references into any stack -- a new object can be referred to only by a register, and that's okay. References in native C code are equally fine. Objects found by tracing can be collected normally.

I think the page pinning relies on stop-the-world GC, so it may not make sense here. (Pointers inside the pinned objects would need to be updated no matter what, and if threads are still running, they may be picking up new references to pin.) It may be possible to merge this with the sneaky page-unmapping of G4.


# function metadata

san francisco, ca -- 8 feb 2015

Writing this down because it's been in my RTM list for over a year: Wibble functions should keep their text source around as metadata, for introspection.


# duck typing

san jose, ca -- 16 mar 2015

Rus described a work problem that sounds like a great selling point for duck typing. They have a java library, and they'd like to swap it out for another, but the interface is in the library, so at the very least, the new library would need to reproduce (most of) the original API in a new namespace, and their code would need to change package names everywhere.

Node has a similar thing, where "express" is the standard web server, and other libraries like "restify" mimic the API so that plugins written for express will work (usually) with restify. It works because there's no formal interface file that has to be installed with express (or pulled out into a standard library). Duck typing means that if you swap in a new library for express, and it has the same API, then it will work.

Duck typing. It's what's for dinner.


# bitwise operators

san josé, ca -- 20 aug 2015

Just finished reading a nice critique of C# by one of the designers: http://www.informit.com/articles/article.aspx?p=2425867

He gave one short mention to the presence of a unary `+` operator, which I suddenly agreed *is* a silly idea. Wibble should remove that. Many other points in the article were recognitions of things the PL world has learned since the original C# design (like old-style for loops, and a bunch of archaic C syntax).

But a really fresh upsight was that bitwise operators do not belong in standard int syntax. I now agree. The `Int` type should be restricted to number operations, and there shouldn't be any line-noise symbols that represent bitwise operators: so no `&`, `|`, `^`, `>>`, or `<<`.

Instead, there should be a special type for "set of bits", and probably one for each common machine word size: 8, 16, 32, 64. Maybe `Bits64`? Then those should have word-operators for bit operations.

    let flags = cstruct.readBits32()
    if flags.mask(WritePermission).nonZero() then write()


# let, make

san josé, ca -- 6 sep 2015

I have an old note here that I never typed up: For a while I was infatuated with the python/coffee way of declaring variables: just use them, and the first use is the declaration. But after playing with ES6 a bit more, I see the advantage of having declarations leap out at you when scanning code (especially with a syntax highlighter). Having a keyword like "var" or "val" makes it easy to figure out what scope a local is in when you're confused.

So my current idea is to use a different keyword for mutables and immutables, like scala and ES6.

- let: immutable (like lisp)
- make: mutable

    let pi = 3.14159
    make count := 0



decimal.js
