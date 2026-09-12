import type { BenchCase } from '../harness';
import { makeColdCase, makeHotCase } from '../fixtures/cases';
import {
  makeAliasChain,
  makeDeepChain,
  makeFactoryChain,
} from '../fixtures/graph';
import { Injector, Quantity } from '../redi';

const deep = makeDeepChain(20);
const alias = makeAliasChain(50);
const factory = makeFactoryChain(50);
const missingInjector = new Injector([]);

export const cases: BenchCase[] = [
  makeHotCase(
    'resolve',
    'hot class chain (depth=20)',
    deep.registration,
    deep.root,
  ),

  makeHotCase(
    'resolve',
    'hot value token',
    [['bench:resolve:value', { useValue: 1 }]],
    'bench:resolve:value',
  ),

  makeHotCase(
    'resolve',
    'hot alias chain (depth=50)',
    alias.registration,
    alias.rootId,
  ),

  makeColdCase(
    'resolve',
    'cold alias chain (depth=50)',
    alias.registration,
    alias.rootId,
  ),

  makeColdCase(
    'resolve',
    'cold factory chain (depth=50)',
    factory.registration,
    factory.rootId,
  ),

  {
    group: 'resolve',
    name: 'optional miss',
    fn: () => missingInjector.get('bench:resolve:missing', Quantity.OPTIONAL),
  },

  {
    group: 'resolve',
    name: 'has() missing',
    fn: () => missingInjector.has('bench:resolve:missing'),
  },
];
