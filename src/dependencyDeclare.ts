import type { Ctor, FactoryDep } from './dependencyItem';
import { setDependency } from './decorators';
import { normalizeFactoryDeps } from './dependencyDescriptor';

/**
 * Register dependencies on a class without using decorators.
 *
 * This is useful when you cannot use decorators (e.g., in plain JavaScript)
 * or when you need to define dependencies programmatically.
 *
 * @param registerTarget - The target class constructor to register dependencies on.
 * @param deps - An array of dependencies. Each dependency can be:
 *   - A simple identifier (class, string, or identifier created by `createIdentifier`)
 *   - An array with modifiers like `[Optional, SomeService]` or `[Many, SomeService]`
 * @param startIndex - The starting parameter index for dependencies. Default is 0.
 *   Use this when your constructor has custom parameters before the injected dependencies.
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(customParam, authService, loggerService) {}
 * }
 *
 * // Register dependencies starting at index 1 (after customParam)
 * setDependencies(MyService, [AuthService, LoggerService], 1);
 *
 * // With optional dependency
 * setDependencies(MyService, [[Optional, CacheService], LoggerService], 1);
 * ```
 */
export function setDependencies<U>(registerTarget: Ctor<U>, deps: FactoryDep<any>[], startIndex = 0): void {
  const normalizedDescriptors = normalizeFactoryDeps(deps, startIndex);
  normalizedDescriptors.forEach((descriptor) => {
    setDependency(registerTarget, descriptor.identifier, descriptor.paramIndex, descriptor.quantity, descriptor.lookUp);
  });
}
