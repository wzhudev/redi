import type { DependencyIdentifier } from './dependencyIdentifier';
import type {
  FactoryDep,
  FactoryDependencyItem,
  FactoryDepModifier,
} from './dependencyItem';
import { Self, SkipSelf } from './dependencyLookUp';
import { Many, Optional } from './dependencyQuantity';
import { LookUp, Quantity } from './types';

export interface DependencyDescriptor<T> {
  paramIndex: number;
  identifier: DependencyIdentifier<T>;
  quantity: Quantity;
  lookUp?: LookUp;
  withNew: boolean;
}

/**
 * describes dependencies of a IDependencyItem
 */
export interface Dependencies {
  dependencies: DependencyDescriptor<any>[];
}

/**
 * Cache of normalized factory dependencies keyed by the factory item object.
 * Factory items are long-lived objects owned by a dependency registration, so
 * re-normalizing their `deps` on every resolution is pure overhead.
 */
const factoryDependenciesCache = new WeakMap<
  FactoryDependencyItem<any>,
  DependencyDescriptor<any>[]
>();

/**
 * @internal
 */
export function getFactoryDependencies(
  item: FactoryDependencyItem<any>,
): DependencyDescriptor<any>[] {
  let cached = factoryDependenciesCache.get(item);
  if (!cached) {
    cached = normalizeFactoryDeps(item.deps);
    factoryDependenciesCache.set(item, cached);
  }

  return cached;
}

export function normalizeFactoryDeps(
  deps?: FactoryDep<any>[],
  startIndex = 0,
): DependencyDescriptor<any>[] {
  if (!deps) {
    return [];
  }

  return deps.map((dep, index) => {
    index += startIndex;

    if (!Array.isArray(dep)) {
      return {
        paramIndex: index,
        identifier: dep,
        quantity: Quantity.REQUIRED,
        withNew: false,
      };
    }

    const modifiers = dep.slice(0, dep.length - 1) as FactoryDepModifier[];
    const identifier = dep[dep.length - 1] as DependencyIdentifier<any>;

    let lookUp: LookUp | undefined;
    let quantity = Quantity.REQUIRED;
    let withNew = false;

    (modifiers as FactoryDepModifier[]).forEach(
      (modifier: FactoryDepModifier) => {
        if (modifier instanceof Self) {
          lookUp = LookUp.SELF;
        } else if (modifier instanceof SkipSelf) {
          lookUp = LookUp.SKIP_SELF;
        } else if (modifier instanceof Optional) {
          quantity = Quantity.OPTIONAL;
        } else if (modifier instanceof Many) {
          quantity = Quantity.MANY;
        } /* if  (modifier instanceof WithNew) */ else {
          withNew = true;
        }
      },
    );

    return {
      paramIndex: index,
      identifier: identifier as DependencyIdentifier<any>,
      quantity,
      lookUp,
      withNew,
    };
  });
}
