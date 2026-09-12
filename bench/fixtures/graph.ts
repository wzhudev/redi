import type { Ctor, Dependency } from '../redi';
import { setDependencies } from '../redi';

export interface ClassGraph {
  /** The entry-point class of the graph. */
  root: Ctor<any>;
  /** The registration tuples that make the whole graph resolvable. */
  registration: Dependency[];
}

export interface TokenGraph {
  /** The identifier of the entry-point dependency. */
  rootId: string;
  /** The registration tuples that make the whole graph resolvable. */
  registration: Dependency[];
}

/**
 * Build a linear `Root -> ... -> Leaf` class chain, where the leaf has no
 * dependencies. `depth` is the total number of classes (leaf included).
 */
export function makeDeepChain(depth: number): ClassGraph {
  const classes: Ctor<any>[] = [];

  for (let index = 0; index < depth; index += 1) {
    if (index === 0) {
      classes.push(class Leaf {});
      continue;
    }

    const dependency = classes[index - 1];
    class Node {
      constructor(public readonly next: unknown) {}
    }
    setDependencies(Node, [dependency]);
    classes.push(Node);
  }

  return {
    root: classes[classes.length - 1],
    registration: classes.map((ctor) => [ctor] as [Ctor<any>]),
  };
}

/**
 * Build a root class that depends on `width` independent leaf classes
 * ("fan-out" / wide graph).
 */
export function makeWideGraph(width: number): ClassGraph {
  const leaves: Ctor<any>[] = [];

  for (let index = 0; index < width; index += 1) {
    leaves.push(class Leaf {});
  }

  class Root {
    constructor(...dependencies: unknown[]) {
      void dependencies;
    }
  }
  setDependencies(Root, leaves);

  return {
    root: Root,
    registration: [
      ...leaves.map((ctor) => [ctor] as [Ctor<any>]),
      [Root] as [Ctor<any>],
    ],
  };
}

/**
 * Build an alias chain (`useExisting`) to measure pure graph traversal
 * without paying for any constructor invocation.
 */
export function makeAliasChain(depth: number): TokenGraph {
  const leafId = 'bench:alias:leaf';
  const registration: Dependency[] = [[leafId, { useValue: {} }]];
  let previousId = leafId;

  for (let index = 1; index <= depth; index += 1) {
    const id = `bench:alias:${index}`;
    registration.push([id, { useExisting: previousId }]);
    previousId = id;
  }

  return { rootId: previousId, registration };
}

/**
 * Build a factory chain where each factory simply returns its single
 * dependency. Keeps the resolver traversal cost but reduces construction to
 * a near-zero function call, isolating resolution overhead from `new`.
 */
export function makeFactoryChain(depth: number): TokenGraph {
  const leafId = 'bench:factory:leaf';
  const registration: Dependency[] = [[leafId, { useFactory: () => ({}) }]];
  let previousId = leafId;

  for (let index = 1; index <= depth; index += 1) {
    const id = `bench:factory:${index}`;
    registration.push([
      id,
      { useFactory: (dependency: unknown) => dependency, deps: [previousId] },
    ]);
    previousId = id;
  }

  return { rootId: previousId, registration };
}
