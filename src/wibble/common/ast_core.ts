import { mergeSpan, Span, Token } from "packrattle";

export type Source = (Token | HasSource)[];
export interface HasSource {
  source: Source;
  span: Span;
}

function sourceToCode(source: Source): string {
  return source.map(t => (t instanceof Token) ? t.value : sourceToCode(t.source)).join("");
}

export class PNode {
  public precedence = 1;
  public parent?: PNode;
  private _span: Span;

  // series of tokens (or nested PNodes) that make up this expression tree
  public source: Source = [];

  constructor(public description: string, public children: PNode[] = []) {
    this.children = this.children.filter(c => c != null);
    this.children.forEach(c => {
      c.parent = this;
    });
//     // other common fields: comment, trailingComment
  }

//   get nodeType() {
//     return this.constructor.name;
//   }

  overrideSpan(span: Span) {
    this._span = span;
  }

  get span(): Span {
    if (this._span !== undefined) return this._span;
    if (this.source.length == 0) return new Span(0, 0);
    const span = this._span = mergeSpan(this.source[0].span, this.source[this.source.length - 1].span);
    return span;
  }

  toString(): string {
    return this.inspect();
  }

  inspect(dump: boolean = false): string {
    if (dump) return this.dump().join("\n");

    let rv = this.description;
    if (this.children.length > 0) {
      rv += "{ " + this.children.map(c => c.inspect()).join(", ") + " }";
    }
    // if (this.comment) rv += "#\"" + cstring(this.comment) + "\"";
    // if (this.trailingComment) rv += "##\"" + cstring(this.trailingComment) + "\"";
    // generated nodes may have no span.
    rv += "[" + this.span.start + ":" + this.span.end + "]";
    return rv;
  }

  dump(): string[] {
    const rv = [ this.description ];
    // if (this.scope) rv.push("scope=" + this.scope.inspect());
    // if (this.computedType) rv.push("type=" + this.computedType.inspect());
    // if (this.newType) rv.push("newType=" + this.newType.inspect());
    const children = this.children.map(c => c.dump());
    children.forEach((lines, i) => {
      const [ branch, tail ] = (i == children.length - 1) ? [ "`-", "  " ] : [ "|-", "| " ];
      rv.push(branch + lines[0]);
      lines.slice(1).forEach(line => rv.push(tail + line));
    });
    return rv;
  }

  toCode(): string {
    return sourceToCode(this.source);
  }
}


// an item and whatever linespace, separator, and whitespace came after it
export class AnnotatedItem<A extends PNode> implements HasSource {
  public span: Span;
  public source: Source = [];

  constructor(
    public item: A,
    public gap1: Token | undefined,
    public separator: Token | undefined,
    public gap2: Token[]
  ) {
    let lastSpan = this.item.span;
    this.source.push(item);
    if (this.gap1 !== undefined) {
      lastSpan = this.gap1.span;
      this.source.push(this.gap1);
    }
    if (this.separator !== undefined) {
      lastSpan = this.separator.span;
      this.source.push(this.separator);
    }
    if (this.gap2.length > 0) lastSpan = this.gap2[this.gap2.length - 1].span;
    this.source = this.source.concat(this.gap2);
    this.span = mergeSpan(this.item.span, lastSpan);
  }
}

export class TokenCollection<A extends PNode> implements HasSource {
  public span: Span;
  public source: Source = [];

  constructor(
    public open: Token,
    public gap1: Token[],
    public list: AnnotatedItem<A>[],
    public gap2: Token[],
    public close: Token
  ) {
    this.span = mergeSpan(open.span, close.span);
    this.source = this.source.concat(open, gap1, list, gap2, close);
  }
}
