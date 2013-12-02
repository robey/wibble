
# contexts

roanoke, va -- 6 june 2012

i had an upsight last night: i think it's a really cool property of languages
like lisp that most of the language can be built on top of a few simple
features. so i was thinking about the distinctions between a function and an
object, and why i was having trouble figuring out which should be implemented
in terms of the other.

already i wanted to make the base type be a "thing that can receive messages",
but that was just an implementation detail. last night i realized that the
"thing that can receive messages" should be the *main* implementation, and
function and object should be built on top of that.

so: each code block of `{ ... }` should create a new context: a new set of
local variables. it should also be able to receive messages, and there should
be syntax for letting a context say that it can handle a certain type of
message, and run some code in that case. something like:

    {
      x = 3
      on create { ... }
    }

the code block is an "object" of sorts. it has a field "x", which is a local
variable, and it can do something when it receives the "create" message. a
function for computing the hypotenuse distance could then be:

    @distance = {
      on (x: Int, y: Int) { ((x * x) + (y * y)) ** 0.5 }
    }

it's an object that can receive a single type of message: a struct with int
"x" and int "y". the syntax of

    @distance = (x: Int, y: Int) => ((x * x) + (y * y)) ** 0.5

could just be sugar for the object creation. so could

    def distance(x: Int, y: Int) = ((x * x) + (y * y)) ** 0.5

the python-style class, where the class is really a function that creates new
objects, falls out too:

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

if it's not a value, the type must be a struct type so that the fields can be
bound into the code body as locals. allowing a simple type like "Int" raises
the question of: how do i access this int from inside the handler? it also
creates an ambiguity between a struct that contains only one int versus a bare
int type, because of the sugar that allows you to send a message of a single
int to a function that requires only one int as a parameter (instead of making
you build a single-element struct).


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












