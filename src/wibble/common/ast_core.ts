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

// could be a Token or PNode (or fake Token)
export interface PChildNode {
  span: Span;

  // tokens have:
  value?: string;
  children?: PChildNode[];
}

export type ImplicitChildNode = PChildNode | PChildNode[] | undefined;

export function sourceCode(nodes: PChildNode[]): string {
  return nodes.map(t => {
    if (t.children !== undefined) return sourceCode(t.children);
    return t.value;
  }).join("");
}

function flattenNodes(...list: ImplicitChildNode[]): PChildNode[] {
  let rv: PChildNode[] = [];
  list.forEach(x => {
    if (x === undefined) return;
    if (Array.isArray(x)) {
      rv = rv.concat(x);
    } else {
      rv.push(x);
    }
  });
  return rv;
}

function computeSpan(nodes: PChildNode[]): Span {
  if (nodes.length == 0) return new Span(0, 0);
  return mergeSpan(nodes[0].span, nodes[nodes.length - 1].span);
}

/*
 * Ignoring raw tokens, return the list of AST nodes from a list of
 * children. If any child is a collection, flatten it in.
 */
function computeChildNodes(nodes: PChildNode[]): PNode[] {
  return flattenNodes(...nodes.map(x => {
    if (x instanceof PNode) return x;
    if (x instanceof TokenCollection) return x.childNodes;
    if (x instanceof AnnotatedItem) return x.item;
    return undefined;
  })) as PNode[];
}

  // // fill in 'parent' fields.
  // this.children.forEach(x => {
  //   if (x instanceof PNode && this instanceof PNode) {
  //     (x as PNode).parent = this as PNode;
  //   }
  // });

class NodeSpan {
  // sequence of PNode or token-like objects that make up this expression tree
  public children: PChildNode[] = [];

  private _span: Span;

  constructor(...list: ImplicitChildNode[]) {
    this.replaceChildren(...list);
  }

  replaceChildren(...list: ImplicitChildNode[]) {
    this.children = flattenNodes()
    this._span = computeSpan(this.children);

    this.children = [];
    list.forEach(x => {
      if (x === undefined) return;
      if (Array.isArray(x)) {
        this.children = this.children.concat(x);
      } else {
        this.children.push(x);
      }
    });

    // fill in 'parent' fields.
    this.children.forEach(x => {
      if (x instanceof PNode && this instanceof PNode) {
        (x as PNode).parent = this as PNode;
      }
    });
  }

  // override this in intermediate containers

  get span(): Span {
    if (this._span !== undefined) return this._span;
    if (this.children.length == 0) return new Span(0, 0);
    const span = this._span = mergeSpan(this.children[0].span, this.children[this.children.length - 1].span);
    return span;
  }
}

/*
 * An AST node which contains a node type, a covering span, and possibly a
 * sequence of children (which may be tokens or nested PNodes).
 */
export class PNode {
  public parent?: PNode;
  public children: PChildNode[];
  public span: Span;
  public nodes: PNode[];

  constructor(public nodeType: PNodeType, public description: string, ...list: ImplicitChildNode[]) {
    this.replaceChildren(...list);
  }

  replaceChildren(...list: ImplicitChildNode[]) {
    this.children = flattenNodes(...list);
    this.span = computeSpan(this.children);
    this.nodes = computeChildNodes(this.children);
    this.nodes.forEach(n => n.parent = this);
  }

  toString(): string {
    return this.inspect();
  }

  inspect(): string {
    const spanString = "[" + this.span.start + ":" + this.span.end + "]";
    const vals = this.nodes.map(n => n.inspect()).filter(x => x.length > 0);
    const nested = (vals.length == 0) ? "" : ("{ " + vals.join(", ") + " }");
    return this.description + nested + spanString;
  }

  dump(): string[] {
    const rv = [ this.description ];
    // if (this.scope) rv.push("scope=" + this.scope.inspect());
    // if (this.computedType) rv.push("type=" + this.computedType.inspect());
    // if (this.newType) rv.push("newType=" + this.newType.inspect());
    const children = this.nodes.map(c => c.dump());
    children.forEach((lines, i) => {
      const [ branch, tail ] = (i == children.length - 1) ? [ "`-", "  " ] : [ "|-", "| " ];
      rv.push(branch + lines[0]);
      lines.slice(1).forEach(line => rv.push(tail + line));
    });
    return rv;
  }

  toCode(): string {
    return sourceCode(this.children);
  }
}


// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNode> implements PChildNode {
  public span: Span;
  public children: PChildNode[];

  constructor(
    public item: A,
    public gap1: Token | undefined,
    public separator: Token | undefined,
    public gap2: Token[]
  ) {
    this.children = flattenNodes(item, gap1, separator, gap2);
    this.span = computeSpan(this.children);
  }
}

/*
 * A tokenized item list where the source looks something like
 *     (x, y, z)
 * where the open/close parens and the comma could be any tokens. Each item
 * is attached to its follow-on separator and whitespace, if any.
 */
export class TokenCollection<A extends PNode> implements PChildNode {
  public span: Span;
  public children: PChildNode[];

  constructor(
    public open: Token,
    public gap1: Token[],
    public list: AnnotatedItem<A>[],
    public gap2: Token[],
    public close: Token
  ) {
    this.children = flattenNodes(open, gap1, list, gap2, close);
    this.span = computeSpan(this.children);
  }

  get childNodes(): A[] {
    return this.list.map(x => x.item);
  }
}
