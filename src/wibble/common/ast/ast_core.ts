import { mergeSpan, Span, Token } from "packrattle";

export enum PTypeKind {
  EMPTY_TYPE = 1,
  SIMPLE_TYPE,
  TYPED_FIELD,
  COMPOUND_TYPE,
  TEMPLATE_TYPE,
  PARAMETER_TYPE,
  FUNCTION_TYPE,
  NESTED_TYPE,
  MERGED_TYPE,
  INLINE_TYPE_DECLARATION,
  INLINE_TYPE,
}

export enum PExprKind {
  CONSTANT = 1,
  REFERENCE,
  ARRAY,
  FUNCTION,       // X
  STRUCT_FIELD,
  STRUCT,
  NESTED,
  NEW,
  UNARY,          // X
  CALL,
  BINARY,         // X
  LOGIC,
  IF,
  REPEAT,
  WHILE,          // X
  ASSIGNMENT,
  RETURN,
  BREAK,
  LOCAL,
  LOCALS,
  ON,
  BLOCK
}

/*
 * X - eliminated by simplify
 */


/*
 * An AST node may be:
 *   - a raw token (syntax span of the source with no other meaning, like ",")
 *   - an expression (like `BINARY`) with child nodes (some tokens, some nested expressions)
 *   - a collection (like a list of comma-separated expressions and their whitespace tokens)
 */
export abstract class PNode {
  abstract span: Span;
  children: PNode[] = [];
  parent?: PNode;

  constructor(public description: string) {
    // pass
  }

  // return the parent node if it's an expression
  get parentExpr(): PExpr | undefined {
    if (this.parent === undefined) return undefined;
    if (this.parent instanceof PExpr) return this.parent;
    return this.parent.parentExpr;
  }

  // are we contained (somewhere up the tree) inside a node of a certain type?
  containedInside(nodeType: PExprKind): boolean {
    console.log("containedInside?", nodeType, this.parent ? this.parent.description : null, this.parentExpr ? this.parentExpr.description : undefined, this);
    const parent = this.parentExpr;
    if (parent === undefined) return false;
    return parent.nodeType == nodeType || parent.containedInside(nodeType);
  }

  // reconstitute something similar to the original source
  abstract source(): string;

  // for debugging
  abstract inspect(): string;

  // for collections: flatten out the list of nested expressions
  abstract expressions(): PExpr[];

  // dump(): string[] {
  //   const rv = [ this.description ];
  //   if (this.parent) rv.push(`(parent: ${this.parent.description})`);
  //   const children = this.children.map(c => c.dump());
  //   // if (this.scope) rv.push("scope=" + this.scope.inspect());
  //   // if (this.computedType) rv.push("type=" + this.computedType.inspect());
  //   // if (this.newType) rv.push("newType=" + this.newType.inspect());
  //   children.forEach((lines, i) => {
  //     const [ branch, tail ] = (i == children.length - 1) ? [ "`-", "  " ] : [ "|-", "| " ];
  //     rv.push(branch + lines[0]);
  //     lines.slice(1).forEach(line => rv.push(tail + line));
  //   });
  //   return rv;
  // }
}


// PNode wrapper for a token
export class PNodeToken extends PNode {
  span: Span;

  constructor(public token: Token) {
    super(`Token:${token.value}`);
    this.span = this.token.span;
  }

  source(): string {
    // raw token in the AST always has a value
    return this.token.value;
  }

  inspect(): string {
    return this.token.value;
  }

  expressions(): PExpr[] {
    return [];
  }
}


// a PNode with children
export abstract class PParentNode extends PNode {
  // have to mark this as "assert assigned" because the compiler doesn't follow the replaceChildren() method call.
  span!: Span;

  constructor(description: string, children: ImplicitNode[]) {
    super(description);
    this.replaceChildren(children);
  }

  replaceChildren(list: ImplicitNode[]) {
    this.children = flattenNodes(list);
    // must have at least one child
    if (this.children.length == 0) throw new Error("No children");
    this.children.forEach(n => n.parent = this);
    this.span = mergeSpan(this.children[0].span, this.children[this.children.length - 1].span);
  }

  source(): string {
    return this.children.map(n => n.source()).join("");
  }

  inspect(): string {
    const nested = this.children.filter(c => !(c instanceof PNodeToken)).map(n => n.inspect()).filter(s => s != "");
    return this.description + (nested.length == 0 ? "" : `{ ${nested.join(", ")} }`) + this.span.toString();
  }
}


// PNode for expression subtrees
export class PExpr extends PParentNode {
  constructor(public nodeType: PExprKind, description: string, list: ImplicitNode[]) {
    super(description, list);
  }

  expressions(): PExpr[] {
    return [ this ];
  }
}


// PNode for type subtrees
export class PType extends PParentNode {
  constructor(public nodeType: PTypeKind, description: string, list: ImplicitNode[]) {
    super(description, list);
  }

  expressions(): PExpr[] {
    return [];
  }
}


// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNode> extends PParentNode {
  constructor(
    public item: A,
    public gap1: Token | undefined,
    public separator: Token | undefined,
    public gap2: Token[]
  ) {
    super("AnnotatedItem", [ item, gap1, separator, gap2 ]);
  }

  inspect(): string {
    return this.item.inspect();
  }

  expressions(): PExpr[] {
    return this.item instanceof PExpr ? [ this.item ] : [];
  }
}


/*
 * A tokenized item list where the source looks something like
 *     (x, y, z)
 * where the open/close parens and the comma could be any tokens. Each item
 * is attached to its follow-on separator and whitespace, if any.
 */
export class TokenCollection<A extends PNode> extends PParentNode {
  constructor(
    public open: Token,
    public gap1: Token[],
    public list: AnnotatedItem<A>[],
    public gap2: Token[],
    public close: Token
  ) {
    super("TokenCollection", [ open, gap1, list, gap2, close ]);
  }

  inspect(): string {
    return this.list.map(x => x.inspect()).join(", ");
  }

  expressions(): PExpr[] {
    return ([] as PExpr[]).concat(...this.list.map(x => x.expressions()));
  }
}


// make it easy for parser classes to generate their trees
export type ImplicitNode = PNode | PNode[] | Token | Token[] | undefined;
function flattenNodes(list: ImplicitNode[]): PNode[] {
  let rv: PNode[] = [];
  list.forEach(x => {
    if (x === undefined) return;
    if (Array.isArray(x)) {
      flattenNodes(x).forEach(n => rv.push(n));
    } else {
      if (x instanceof Token) {
        rv.push(new PNodeToken(x));
      } else {
        rv.push(x);
      }
    }
  });
  return rv;
}
