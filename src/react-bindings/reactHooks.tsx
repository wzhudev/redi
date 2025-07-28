import type {
  DependencyIdentifier,
  Injector,
  LookUp,
  Quantity,
} from '@wendellhu/redi';
import { RediError } from '@wendellhu/redi';
import { use, useContext, useMemo } from 'react';
import { RediContext } from './reactContext';

class HooksNotInRediContextError extends RediError {
  constructor() {
    super('Using dependency injection outside of a RediContext.');
  }
}

export function useInjector(): Injector {
  const injectionContext = useContext(RediContext);
  if (!injectionContext.injector) {
    throw new HooksNotInRediContextError();
  }

  return injectionContext.injector;
}

export function useDependency<T>(
  id: DependencyIdentifier<T>,
  lookUp?: LookUp,
): T;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantity: Quantity.MANY,
  lookUp?: LookUp,
): T[];
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantity: Quantity.OPTIONAL,
  lookUp?: LookUp,
): T | null;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantity: Quantity.REQUIRED,
  lookUp?: LookUp,
): T;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantity: Quantity,
  lookUp?: LookUp,
): T | T[] | null;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantity?: Quantity,
  lookUp?: LookUp,
): T | T[] | null;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantityOrLookUp?: Quantity | LookUp,
  lookUp?: LookUp,
): T | T[] | null {
  const injector = useInjector();
  return useMemo(
    () => injector.get<T>(id, quantityOrLookUp, lookUp),
    [id, quantityOrLookUp, lookUp],
  );
}

/**
 * A Suspense-friendly version of useDependency that can handle async dependencies.
 * When the dependency is async, this hook will suspend the component until the dependency is resolved.
 * This hook uses React 19's `use` syntax to work with Suspense.
 *
 * Note: This hook currently only supports REQUIRED quantity for async dependencies,
 * as the injector's getAsync method only supports required dependencies.
 */
export function useAsyncDependency<T>(id: DependencyIdentifier<T>): T {
  const injector = useInjector();
  const promiseOrValue = useMemo(
    () => injector.getAsync<T>(id),
    [injector, id],
  );
  return use(promiseOrValue);
}
