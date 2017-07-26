import { mergeSpan, Span, Token } from "packrattle";

export enum PNodeType {
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
  CONSTANT,
  REFERENCE,
  ARRAY,
  FUNCTION,
  STRUCT_FIELD,
  STRUCT,
  NESTED,
  NEW,
  UNARY,
  CALL,
  BINARY,
  LOGIC,
  IF,
  REPEAT,
  WHILE,
  ASSIGNMENT,
  RETURN,
  BREAK,
  LOCAL,
  LOCALS,
  ON,
  BLOCK
}

/*
 * An AST node may be:
 *   - a raw token (syntax span of the source with no other meaning, like ",")
 *   - an expression (like `BINARY`) with child nodes (some tokens, some nested expressions)
 *   - a collection (like a list of comma-separated expressions and their whitespace tokens)
 */
export abstract class PNode {
    span: Span;
    children: PNode[] = [];
    parent?: PNode;

    // selective list of only the PNodeExpr children:
    childExpr: PNodeExpr[];

    constructor(...list: ImplicitNode[]) {
      this.replaceChildren(list);
    }

    replaceChildren(list: ImplicitNode[]) {
      this.children = flattenNodes(list);
      this.children.forEach(n => n.parent = this);
      if (this.children.length > 0) {
        this.span = mergeSpan(this.children[0].span, this.children[this.children.length - 1].span);
      }
      this.childExpr = flattenNodes(this.children.map(n => n.expressions())) as PNodeExpr[];
    }

    get parentExpr(): PNodeExpr | undefined {
      if (this.parent === undefined) return undefined;
      if (this.parent instanceof PNodeExpr) return this.parent;
      return this.parent.parentExpr;
    }

    // default implementation assumes children; Token will override
    get source(): string {
      return this.children.map(n => n.source).join("");
    }

    // friendly debug-view of this tree
    abstract debug(): string | undefined;

    // for collections: flatten out the list of nested expressions
    abstract expressions(): PNodeExpr[];

    inspect(): string {
      return this.debug() || "";
    }
}

// make it easy for parser classes to generate their trees
export type ImplicitNode = PNode | PNode[] | Token | Token[] | undefined;
function flattenNodes(list: ImplicitNode[]): PNode[] {
  let rv: PNode[] = [];
  list.forEach(x => {
    if (x === undefined) return;
    if (Array.isArray(x)) {
      if (x.length > 0) rv = rv.concat(flattenNodes(x));
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


// PNode wrapper for a token
export class PNodeToken extends PNode {
  constructor(public token: Token) {
    super();
  }

  get span(): Span {
    return this.token.span;
  }

  get source(): string {
    return this.token.value;
  }

  debug(): string | undefined {
    return undefined;
  }

  expressions(): PNodeExpr[] {
    return [];
  }
}

// PNode wrapper for some injected text (done during the simplify transforms)
export class PNodeInjected extends PNode {
  span = new Span(0, 0);

  constructor(public _source: string) {
    super();
  }

  get source() {
    return this._source;
  }

  debug(): string | undefined {
    return undefined;
  }

  expressions(): PNodeExpr[] {
    return [];
  }
}

// PNode for expression subtrees
export class PNodeExpr extends PNode {
  constructor(public nodeType: PNodeType, public description: string, ...list: ImplicitNode[]) {
    super(...list);
  }

  debug(): string | undefined {
    const nested = this.children.map(n => n.debug()).filter(n => n !== undefined) as string[];
    return this.description + (nested.length == 0 ? "" : `{ ${nested.join(", ")} }`) + this.span.toString();
  }

  expressions(): PNodeExpr[] {
    return [ this ];
  }
}

// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNodeExpr> extends PNode {
  constructor(
    public item: A,
    public gap1: PNode | undefined,
    public separator: PNode | undefined,
    public gap2: PNode[]
  ) {
    super(item, gap1, separator, gap2);
  }

  debug(): string | undefined {
    return this.item.debug();
  }

  expressions(): PNodeExpr[] {
    return [ this.item ];
  }
}

/*
 * A tokenized item list where the source looks something like
 *     (x, y, z)
 * where the open/close parens and the comma could be any tokens. Each item
 * is attached to its follow-on separator and whitespace, if any.
 */
export class TokenCollection<A extends PNodeExpr> extends PNode {
  constructor(
    public open: PNode,
    public gap1: PNode[],
    public list: AnnotatedItem<A>[],
    public gap2: PNode[],
    public close: PNode
  ) {
    super(open, gap1, list, gap2, close);
  }

  debug(): string | undefined {
    const list = this.list.map(x => x.debug()).filter(x => x !== undefined);
    return list.length == 0 ? undefined : list.join(", ");
  }

  expressions(): PNodeExpr[] {
    return this.list.map(x => x.item);
  }
}









   // dump(): string[] {
  //   const rv = [ this.description ];
  //   // if (this.scope) rv.push("scope=" + this.scope.inspect());
  //   // if (this.computedType) rv.push("type=" + this.computedType.inspect());
  //   // if (this.newType) rv.push("newType=" + this.newType.inspect());
  //   const children = this.nodes.map(c => c.dump());
  //   children.forEach((lines, i) => {
  //     const [ branch, tail ] = (i == children.length - 1) ? [ "`-", "  " ] : [ "|-", "| " ];
  //     rv.push(branch + lines[0]);
  //     lines.slice(1).forEach(line => rv.push(tail + line));
  //   });
  //   return rv;
  // }
