/* eslint-disable jsdoc/check-param-names */

import type { DependencyIdentifier, Injector, LookUp, Quantity } from '@wendellhu/redi';
import { RediError } from '@wendellhu/redi';
import { useContext, useMemo } from 'react';
import { RediContext } from './reactContext';

class HooksNotInRediContextError extends RediError {
  constructor() {
    super('Using dependency injection outside of a RediContext.');
  }
}

/**
 * A React hook that returns the current Injector from the RediContext.
 *
 * Use this hook when you need direct access to the injector for
 * dynamic dependency resolution or advanced use cases.
 *
 * @returns The current Injector instance.
 * @throws {HooksNotInRediContextError} If used outside of a RediContext.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const injector = useInjector();
 *
 *   const handleClick = () => {
 *     // Dynamic resolution
 *     const service = injector.get(SomeService);
 *     service.doSomething();
 *   };
 *
 *   return <button onClick={handleClick}>Click</button>;
 * }
 * ```
 */
export function useInjector(): Injector {
  const injectionContext = useContext(RediContext);
  if (!injectionContext.injector) {
    throw new HooksNotInRediContextError();
  }

  return injectionContext.injector;
}

/**
 * A React hook that retrieves a dependency from the current Injector.
 *
 * This is the primary way to access dependencies in functional React components.
 * The dependency is memoized and will only be re-resolved if the parameters change.
 *
 * @param id - The dependency identifier (class, string, or identifier created by `createIdentifier`).
 * @param quantityOrLookUp - Either a {@link Quantity} or {@link LookUp} option.
 * @param lookUp - A {@link LookUp} option (if first param is Quantity).
 * @returns The dependency instance, array of instances, or null depending on the quantity.
 *
 * @throws {HooksNotInRediContextError} If used outside of a RediContext.
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   // Required dependency
 *   const userService = useDependency(UserService);
 *
 *   // Optional dependency
 *   const analytics = useDependency(IAnalytics, Quantity.OPTIONAL);
 *
 *   // Multiple implementations
 *   const validators = useDependency(IValidator, Quantity.MANY);
 *
 *   return <div>{userService.getCurrentUser().name}</div>;
 * }
 * ```
 */
export function useDependency<T>(id: DependencyIdentifier<T>, lookUp?: LookUp): T;
export function useDependency<T>(id: DependencyIdentifier<T>, quantity: Quantity.MANY, lookUp?: LookUp): T[];
export function useDependency<T>(id: DependencyIdentifier<T>, quantity: Quantity.OPTIONAL, lookUp?: LookUp): T | null;
export function useDependency<T>(id: DependencyIdentifier<T>, quantity: Quantity.REQUIRED, lookUp?: LookUp): T;
export function useDependency<T>(id: DependencyIdentifier<T>, quantity: Quantity, lookUp?: LookUp): T | T[] | null;
export function useDependency<T>(id: DependencyIdentifier<T>, quantity?: Quantity, lookUp?: LookUp): T | T[] | null;
export function useDependency<T>(
  id: DependencyIdentifier<T>,
  quantityOrLookUp?: Quantity | LookUp,
  lookUp?: LookUp,
): T | T[] | null {
  const injector = useInjector();
  return useMemo(() => injector.get<T>(id, quantityOrLookUp, lookUp), [id, quantityOrLookUp, lookUp]);
}
