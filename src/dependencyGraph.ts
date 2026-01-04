export class GraphNode<T> {
  readonly incoming = new Map<string, GraphNode<T>>();
  readonly outgoing = new Map<string, GraphNode<T>>();

  constructor(
    readonly key: string,
    readonly data: T,
  ) {}
}

/**
 * Minimal directed graph utility used for dependency ordering.
 *
 * Edge direction: `from -> to` means "from depends on to".
 * Nodes with no outgoing edges can be instantiated first.
 */
export class Graph<T> {
  private readonly _nodes = new Map<string, GraphNode<T>>();

  constructor(private readonly _hashFn: (element: T) => string) {}

  public roots(): GraphNode<T>[] {
    const ret: GraphNode<T>[] = [];
    this._nodes.forEach((node) => {
      if (node.outgoing.size === 0) {
        ret.push(node);
      }
    });
    return ret;
  }

  public insertEdge(from: T, to: T): void {
    const fromNode = this.lookupOrInsertNode(from);
    const toNode = this.lookupOrInsertNode(to);

    fromNode.outgoing.set(toNode.key, toNode);
    toNode.incoming.set(fromNode.key, fromNode);
  }

  public removeNode(data: T): void {
    const key = this._hashFn(data);
    this._nodes.delete(key);
    this._nodes.forEach((node) => {
      node.outgoing.delete(key);
      node.incoming.delete(key);
    });
  }

  public lookupOrInsertNode(data: T): GraphNode<T> {
    const key = this._hashFn(data);
    let node = this._nodes.get(key);

    if (!node) {
      node = new GraphNode(key, data);
      this._nodes.set(key, node);
    }

    return node;
  }

  public lookup(data: T): GraphNode<T> | undefined {
    return this._nodes.get(this._hashFn(data));
  }

  public isEmpty(): boolean {
    return this._nodes.size === 0;
  }

  /**
   * Best-effort cycle finder, intended for diagnostics.
   * Returns a key path like: a -> b -> c -> a
   */
  public findCycleSlow(): string[] | undefined {
    const entries: Array<[string, GraphNode<T>]> = [];
    this._nodes.forEach((value, key) => entries.push([key, value]));

    for (let i = 0; i < entries.length; i += 1) {
      const [id, node] = entries[i];
      const seen = new Set<string>();
      seen.add(id);
      const res = this._findCycleFromNode(node, seen, [id]);
      if (res) {
        return res;
      }
    }

    return undefined;
  }

  private _findCycleFromNode(node: GraphNode<T>, seen: Set<string>, path: string[]): string[] | undefined {
    const outgoingEntries: Array<[string, GraphNode<T>]> = [];
    node.outgoing.forEach((value, key) => outgoingEntries.push([key, value]));

    for (let i = 0; i < outgoingEntries.length; i += 1) {
      const [id, outgoing] = outgoingEntries[i];
      if (seen.has(id)) {
        return path.concat([id]);
      }

      seen.add(id);
      path.push(id);

      const value = this._findCycleFromNode(outgoing, seen, path);
      if (value) {
        return value;
      }

      path.pop();
      seen.delete(id);
    }

    return undefined;
  }
}
