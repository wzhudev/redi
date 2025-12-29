import type {
  DependencyIdentifier,
  NormalizedDependencyIdentifier,
} from './dependencyIdentifier';
import type { Ctor } from './dependencyItem';

/**
 * A wrapper that holds a reference to a class constructor that may not be defined yet.
 * Used to resolve circular dependencies between TypeScript files.
 *
 * @template T - The type of the class instance.
 */
export interface ForwardRef<T> {
  /** Unwraps and returns the actual class constructor. */
  unwrap: () => Ctor<T>;
}

/**
 * Create a forward reference to a class that may not be defined yet.
 *
 * This is useful when you have circular dependencies between files.
 * Instead of directly referencing a class (which may be undefined due to
 * the order of ES module initialization), you wrap it in a function that
 * will be called later when the class is definitely available.
 *
 * @param wrapper - A function that returns the class constructor.
 * @returns A ForwardRef object that can be used as a dependency identifier.
 *
 * @example
 * ```typescript
 * // fileA.ts
 * import { forwardRef } from '@wendellhu/redi';
 * import type { ServiceB } from './fileB';
 *
 * class ServiceA {
 *   constructor(@Inject(forwardRef(() => ServiceB)) private b: ServiceB) {}
 * }
 *
 * // fileB.ts
 * import { ServiceA } from './fileA';
 *
 * class ServiceB {
 *   constructor(@Inject(ServiceA) private a: ServiceA) {}
 * }
 * ```
 */
export function forwardRef<T>(wrapper: () => Ctor<T>): ForwardRef<T> {
  return {
    unwrap: wrapper,
  };
}

export function isForwardRef<T = any>(thing: unknown): thing is ForwardRef<T> {
  return !!thing && typeof (thing as any).unwrap === 'function';
}

export function normalizeForwardRef<T>(
  id: DependencyIdentifier<T>,
): NormalizedDependencyIdentifier<T> {
  if (isForwardRef(id)) {
    return id.unwrap();
  }

  return id;
}
