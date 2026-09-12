import type { BenchCase } from '../harness';
import type { Dependency } from '../redi';
import { makeColdCase, makeColdCaseFn, makeHotCaseFn } from '../fixtures/cases';
import { getDependencyByIndex, Quantity, setDependencies } from '../redi';

// ---------------------------------------------------------------------------
// Quantity.MANY
// ---------------------------------------------------------------------------

const MANY_TOKEN = 'bench:many';
const MANY_COUNT = 32;
const manyRegistration: Dependency[] = [];
for (let index = 0; index < MANY_COUNT; index += 1) {
  class ManyImpl {}
  manyRegistration.push([MANY_TOKEN, { useClass: ManyImpl }]);
}

// ---------------------------------------------------------------------------
// Factory with dependencies
// ---------------------------------------------------------------------------

class FactoryA {}
class FactoryB {}
class FactoryC {}

const factoryRegistration: Dependency[] = [
  [FactoryA],
  [FactoryB],
  [FactoryC],
  [
    'bench:factory:complex',
    {
      useFactory: (a: FactoryA, b: FactoryB, c: FactoryC) => ({ a, b, c }),
      deps: [FactoryA, FactoryB, FactoryC],
    },
  ],
];

const FACTORY_TOKEN = 'bench:factory:complex';

// ---------------------------------------------------------------------------
// createInstance / withNew
// ---------------------------------------------------------------------------

class Empty {}
class Leaf {}
class SingletonConsumer {
  constructor(public readonly leaf: Leaf) {}
}
class NewConsumer {
  constructor(public readonly leaf: Leaf) {}
}

setDependencies(SingletonConsumer, [Leaf]);
setDependencies(NewConsumer, [Leaf]);
getDependencyByIndex(NewConsumer, 0).withNew = true;

const instanceRegistration: Dependency[] = [
  [Empty],
  [Leaf],
  [SingletonConsumer],
  [NewConsumer],
];

// ---------------------------------------------------------------------------
// lazy vs eager
// ---------------------------------------------------------------------------

class LazyService {
  public readonly value = 42;
}
class EagerService {
  public readonly value = 42;
}

const lazyRegistration: Dependency[] = [
  [LazyService, { useClass: LazyService, lazy: true }],
  [EagerService],
];

// ---------------------------------------------------------------------------
// async
// ---------------------------------------------------------------------------

const asyncRegistration: Dependency[] = [['bench:async', { useValue: 1 }]];
const ASYNC_TOKEN = 'bench:async';

export const cases: BenchCase[] = [
  makeColdCaseFn(
    'variants:many',
    `cold MANY (count=${MANY_COUNT})`,
    manyRegistration,
    (injector) => injector.get(MANY_TOKEN, Quantity.MANY),
  ),

  makeHotCaseFn(
    'variants:many',
    `hot MANY (count=${MANY_COUNT})`,
    manyRegistration,
    (injector) => injector.get(MANY_TOKEN, Quantity.MANY),
  ),

  makeColdCase(
    'variants:factory',
    'cold factory with 3 deps',
    factoryRegistration,
    FACTORY_TOKEN,
  ),

  makeHotCaseFn(
    'variants:factory',
    'hot factory with 3 deps',
    factoryRegistration,
    (injector) => injector.get(FACTORY_TOKEN),
  ),

  makeHotCaseFn(
    'variants:instance',
    'createInstance no deps',
    instanceRegistration,
    (injector) => injector.createInstance(Empty),
  ),

  makeHotCaseFn(
    'variants:instance',
    'createInstance cached dep',
    instanceRegistration,
    (injector) => injector.createInstance(SingletonConsumer),
  ),

  makeHotCaseFn(
    'variants:instance',
    'createInstance @WithNew dep',
    instanceRegistration,
    (injector) => injector.createInstance(NewConsumer),
  ),

  makeColdCaseFn(
    'variants:lazy',
    'cold eager',
    lazyRegistration,
    (injector) => injector.get(EagerService).value,
  ),

  makeColdCaseFn(
    'variants:lazy',
    'cold lazy',
    lazyRegistration,
    (injector) => injector.get(LazyService).value,
  ),

  makeHotCaseFn(
    'variants:async',
    'getAsync (value)',
    asyncRegistration,
    (injector) => injector.getAsync(ASYNC_TOKEN),
    { batch: 1, async: true },
  ),

  makeHotCaseFn(
    'variants:async',
    'get (value)',
    asyncRegistration,
    (injector) => injector.get(ASYNC_TOKEN),
    { batch: 1 },
  ),
];
