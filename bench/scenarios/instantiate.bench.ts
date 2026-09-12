import type { BenchCase } from '../harness';
import { makeColdCase, makeHotCase } from '../fixtures/cases';
import { makeDeepChain, makeWideGraph } from '../fixtures/graph';

const deepGraphs = [10, 50, 100].map((depth) => ({
  depth,
  graph: makeDeepChain(depth),
}));

const wideGraphs = [10, 50, 200].map((width) => ({
  width,
  graph: makeWideGraph(width),
}));

export const cases: BenchCase[] = [
  ...deepGraphs.map(
    ({ depth, graph }): BenchCase =>
      makeColdCase(
        'instantiate',
        `cold deep chain (depth=${depth})`,
        graph.registration,
        graph.root,
      ),
  ),

  ...wideGraphs.map(
    ({ width, graph }): BenchCase =>
      makeColdCase(
        'instantiate',
        `cold wide graph (width=${width})`,
        graph.registration,
        graph.root,
      ),
  ),

  makeHotCase(
    'instantiate',
    'hot deep chain (depth=100)',
    deepGraphs[deepGraphs.length - 1].graph.registration,
    deepGraphs[deepGraphs.length - 1].graph.root,
  ),
];
