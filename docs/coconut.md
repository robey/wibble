
## coconut

```
data vector(pts):
    """Immutable n-vector."""
    def __new__(cls, *pts):
        """Create a new vector from the given pts."""
        if len(pts) == 1 and pts[0] `isinstance` vector:
            return pts[0] # vector(v) where v is a vector should return v
        else:
            return pts |> tuple |> datamaker(cls) # accesses base constructor
    def __abs__(self):
        """Return the magnitude of the vector."""
        return self.pts |> map$((x) -> x**2) |> sum |> ((s) -> s**0.5)
    def __add__(self, other):
        """Add two vectors together."""
        vector(other_pts) = other
        assert len(other_pts) == len(self.pts)
        return map((+), self.pts, other_pts) |*> vector
    def __sub__(self, other):
        """Subtract one vector from another."""
        vector(other_pts) = other
        assert len(other_pts) == len(self.pts)
        return map((-), self.pts, other_pts) |*> vector
    def __neg__(self):
        """Retrieve the negative of the vector."""
        return self.pts |> map$((-)) |*> vector
    def __eq__(self, other):
        """Compare whether two vectors are equal."""
        match vector(=self.pts) in other:
            return True
        else:
            return False
    def __mul__(self, other):
        """Scalar multiplication and dot product."""
        match vector(other_pts) in other:
            assert len(other_pts) == len(self.pts)
            return map((*), self.pts, other_pts) |> sum # dot product
        else:
            return self.pts |> map$((*)$(other)) |*> vector # scalar multiplication
    def __rmul__(self, other):
        """Necessary to make scalar multiplication commutative."""
        return self * other
```

## wibble

```
type Vector {
  # Immutable n-vector.
  def points: Array(Float)

  def abs {
    @points.map(-> $0 ** 2).fold(0, -> $0 + $1) ** 0.5
  }

  def add(other: Vector) {
    assert @points.length == other.points.length
    @points.zip(other.points).map(-> $0 + $1) |> vector
  }

  def sub(other: Vector) {
    assert @points.length == other.points.length
    @points.zip(other.points).map(-> $0 - $1) |> vector
  }

  def neg {
    @points.map(-> -$0) |> vector
  }

  def equals(other: Vector) {
    @points == other.points
  }

  def mul(other: Vector | Float) {
    other match {
      v: Vector -> {
        # dot product
        assert @points.length == v.points.length
        @points.zip(other.points).map(-> $0 * $1).fold(0, -> $0 + $1)
      }
      f: Float -> {
        # scalar multiply
        @points.map(-> $0 * f) |> vector
      }
    }
  }
}

def vector(obj: Array(Float) | Vector = []) {
  obj match {
    v: Vector -> v
    items: Array(Float) -> new Vector { def points = items }
  }
}
```

... What if we didn't require `def`?

```
type Vector {
  # Immutable n-vector.
  points: Array(Float)

  abs {
    @points.map(-> $0 ** 2).fold(0, -> $0 + $1) ** 0.5
  }

  add(other: Vector) {
    assert @points.length == other.points.length
    @points.zip(other.points).map(-> $0 + $1) |> vector
  }

  sub(other: Vector) {
    assert @points.length == other.points.length
    @points.zip(other.points).map(-> $0 - $1) |> vector
  }

  neg {
    @points.map(-> -$0) |> vector
  }

  equals(other: Vector) {
    @points == other.points
  }

  mul(other: Vector | Float) {
    other match {
      v: Vector -> {
        # dot product
        assert @points.length == v.points.length
        @points.zip(other.points).map(-> $0 * $1).fold(0, -> $0 + $1)
      }
      f: Float -> {
        # scalar multiply
        @points.map(-> $0 * f) |> vector
      }
    }
  }
}

let vector = (obj: Array(Float) | Vector = []) -> {
  obj match {
    v: Vector -> v
    items: Array(Float) -> new Vector { def points = items }
  }
}
```

type := "type" typename "{" field* "}"
field := name or name(params...) optional(: typename) optional(codeblock)

provide := "provide" typename ":" typename "{" field* "}"

```
import Collection from collection
import collection
import List as XList, Vector as XVector from collection
import collection as cx

type List($A) is Collection($A) {

}

provide Vector($A): Collection($A) {
  map(f: $A -> $B) {
    ...
  }
}
```


## collections

type Collection($A) {
  def map(f: $A -> $B): Collection($B)
  def zip(other: Collection($B)): Collection(($A, $B))
}

x.map($0 + $1)
(x: Collection((Int, Int))).map($0 + $1)
(x: Collection((Int, Int))).map((?0: $X0, ?1: $X1) -> ?0 + ?1)
(x: Collection((Int, Int))) ~ .map ~ ((?0: $X0, ?1: $X1) -> ?0 + ?1)
(f: (Int, Int) -> $B) -> Collection($B) ~ ((?0: $X0, ?1: $X1) -> ?0 + ?1)
  -- call (f: (Int, Int) -> $B) ~ (($X0, $X1) -> $X2)

(f: (Int, Int) -> $B) -> Collection($B) ~ ((?0: Int, ?1: Int) -> ?0 + ?1)
(f: (Int, Int) -> $B) -> Collection($B) ~ ((?0: Int, ?1: Int) -> (?0 + ?1): Int)
(f: (Int, Int) -> Int) -> Collection(Int) ~ ((?0: Int, ?1: Int) -> (?0 + ?1): Int)
Collection(Int)

required steps:
  - detect "$0" wildcards and convert to wildcard-type function
      - how far up the AST does the function go? where does it stop?
  - when calling, either side can have wildcards
  - when calling one wildcard with another, if one side has a handler with a concrete param (but wildcard result), use that
  - fill in wildcard params, resolve return type, then do the opposite-direction match
