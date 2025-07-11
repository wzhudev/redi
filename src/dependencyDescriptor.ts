import type { DependencyIdentifier } from './dependencyIdentifier';
import type { FactoryDep, FactoryDepModifier } from './dependencyItem';
import { Self, SkipSelf } from './dependencyLookUp';
import { Many, Optional } from './dependencyQuantity';
import { WithNew } from './dependencyWithNew';
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
        } else if (modifier instanceof WithNew) {
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
