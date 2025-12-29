import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Self, SkipSelf } from './dependencyLookUp';
import type { Many, Optional } from './dependencyQuantity';
import type { WithNew } from './dependencyWithNew';
import { IdentifierDecoratorSymbol } from './dependencyIdentifier';

/**
 * Represents a class constructor type.
 *
 * @template T - The type of instance the constructor creates.
 */
export interface Ctor<T> {
  new (...args: any[]): T;

  name: string;
}

/**
 * Type guard to check if a value is a constructor function.
 *
 * @param thing - The value to check.
 * @returns `true` if the value is a function (constructor), `false` otherwise.
 */
export function isCtor<T>(thing: unknown): thing is Ctor<T> {
  return typeof thing === 'function';
}

/**
 * Hooks that can be attached to dependency items for lifecycle events.
 *
 * @template T - The type of the dependency instance.
 */
export interface DependencyItemHooks<T> {
  /** Called after the dependency instance is created. */
  onInstantiation?: (instance: T) => void;
}

/**
 * A dependency item that provides a class constructor.
 *
 * When resolved, an instance of the class will be created with its dependencies injected.
 *
 * @template T - The type of the class instance.
 *
 * @example
 * ```typescript
 * const injector = new Injector([
 *   [ILogger, { useClass: ConsoleLogger }],
 *   [ICache, { useClass: RedisCache, lazy: true }], // Lazy instantiation
 * ]);
 * ```
 */
export interface ClassDependencyItem<T> extends DependencyItemHooks<T> {
  /** The class constructor to instantiate. */
  useClass: Ctor<T>;
  /** If `true`, the instance will be created lazily when first accessed. */
  lazy?: boolean;
}

/**
 * Type guard to check if a value is a ClassDependencyItem.
 *
 * @param thing - The value to check.
 * @returns `true` if the value has a `useClass` property.
 */
export function isClassDependencyItem<T>(
  thing: unknown,
): thing is ClassDependencyItem<T> {
  if (thing && typeof (thing as any).useClass !== 'undefined') {
    return true;
  }

  return false;
}

/**
 * Modifier decorators that can be applied to factory dependencies.
 */
export type FactoryDepModifier =
  | typeof Self
  | typeof SkipSelf
  | typeof Optional
  | typeof Many
  | typeof WithNew;

/**
 * A factory dependency declaration.
 *
 * Can be either a simple dependency identifier or an array with modifiers.
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * // Simple dependency
 * const dep1: FactoryDep<AuthService> = AuthService;
 *
 * // With modifiers
 * const dep2: FactoryDep<CacheService> = [Optional, CacheService];
 * ```
 */
export type FactoryDep<T> =
  | [...FactoryDepModifier[], DependencyIdentifier<T>]
  | DependencyIdentifier<T>;

/**
 * A dependency item that uses a factory function to create instances.
 *
 * The factory function receives resolved dependencies as arguments
 * and returns the dependency instance.
 *
 * @template T - The type of the instance the factory creates.
 *
 * @example
 * ```typescript
 * const injector = new Injector([
 *   [IConfig, {
 *     useFactory: (env: EnvService) => ({
 *       apiUrl: env.get('API_URL'),
 *       timeout: 5000,
 *     }),
 *     deps: [EnvService],
 *   }],
 * ]);
 * ```
 */
export interface FactoryDependencyItem<T> extends DependencyItemHooks<T> {
  /** The factory function that creates the dependency instance. */
  useFactory: (...deps: any[]) => T;
  /** If `true`, the factory will be called each time the dependency is requested. */
  dynamic?: true;
  /** Dependencies to inject into the factory function as arguments. */
  deps?: FactoryDep<any>[];
}

/**
 * Type guard to check if a value is a FactoryDependencyItem.
 *
 * @param thing - The value to check.
 * @returns `true` if the value has a `useFactory` property.
 */
export function isFactoryDependencyItem<T>(
  thing: unknown,
): thing is FactoryDependencyItem<T> {
  if (thing && typeof (thing as any).useFactory !== 'undefined') {
    return true;
  }

  return false;
}

/**
 * A dependency item that provides a pre-existing value.
 *
 * Use this when you have a value that doesn't need to be constructed.
 *
 * @template T - The type of the value.
 *
 * @example
 * ```typescript
 * const injector = new Injector([
 *   ['API_URL', { useValue: 'https://api.example.com' }],
 *   [IConfig, { useValue: { timeout: 5000, retries: 3 } }],
 * ]);
 * ```
 */
export interface ValueDependencyItem<T> extends DependencyItemHooks<T> {
  /** The value to use as the dependency. */
  useValue: T;
}

/**
 * Type guard to check if a value is a ValueDependencyItem.
 *
 * @param thing - The value to check.
 * @returns `true` if the value has a `useValue` property.
 */
export function isValueDependencyItem<T>(
  thing: unknown,
): thing is ValueDependencyItem<T> {
  if (thing && typeof (thing as any).useValue !== 'undefined') {
    return true;
  }

  return false;
}

/**
 * Reuse an existing dependency. You can consider it as an alias to another dependency.
 */
export interface ExistingDependencyItem<T> extends DependencyItemHooks<T> {
  /**
   * The identifier of the existing dependency.
   */
  useExisting: DependencyIdentifier<T>;
}
export function isExistingDependencyItem<T>(
  thing: unknown,
): thing is ExistingDependencyItem<T> {
  if (thing && typeof (thing as any).useExisting !== 'undefined') {
    return true;
  }

  return false;
}

/**
 * A dependency item that is resolved asynchronously.
 *
 * Use this for dependencies that require async initialization,
 * such as dynamic imports or async configuration loading.
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * const injector = new Injector([
 *   [IHeavyModule, {
 *     useAsync: () => import('./heavy-module').then(m => m.HeavyModule),
 *   }],
 * ]);
 *
 * // Must use getAsync to retrieve
 * const module = await injector.getAsync(IHeavyModule);
 * ```
 */
export interface AsyncDependencyItem<T> extends DependencyItemHooks<T> {
  /**
   * A function that returns a Promise resolving to:
   * - The dependency instance directly
   * - A class constructor to instantiate
   * - A tuple of [identifier, dependency item] for further resolution
   */
  useAsync: () => Promise<
    T | Ctor<T> | [DependencyIdentifier<T>, SyncDependencyItem<T>]
  >;
}

/**
 * Type guard to check if a value is an AsyncDependencyItem.
 *
 * @param thing - The value to check.
 * @returns `true` if the value has a `useAsync` property.
 */
export function isAsyncDependencyItem<T>(
  thing: unknown,
): thing is AsyncDependencyItem<T> {
  if (thing && typeof (thing as any).useAsync !== 'undefined') {
    return true;
  }

  return false;
}

export const AsyncHookSymbol = Symbol('AsyncHook');

/**
 * A hook returned when getting an async dependency synchronously.
 *
 * When you call `injector.get()` on an async dependency, you receive an
 * AsyncHook instead of the actual instance. Call `whenReady()` to get
 * a Promise that resolves to the actual dependency.
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * const hook = injector.get(IAsyncService);
 * if (isAsyncHook(hook)) {
 *   const service = await hook.whenReady();
 * }
 *
 * // Or use getAsync directly
 * const service = await injector.getAsync(IAsyncService);
 * ```
 */
export interface AsyncHook<T> {
  __symbol: typeof AsyncHookSymbol;
  /** Returns a Promise that resolves when the async dependency is ready. */
  whenReady: () => Promise<T>;
}

/**
 * Type guard to check if a value is an AsyncHook.
 *
 * @param thing - The value to check.
 * @returns `true` if the value is an AsyncHook.
 */
export function isAsyncHook<T>(thing: unknown): thing is AsyncHook<T> {
  if (thing && (thing as any).__symbol === AsyncHookSymbol) {
    // FIXME@wzhudev: should not be undefined but a symbol here
    return true;
  }

  return false;
}

/**
 * A synchronous dependency item. Can be one of:
 * - `ClassDependencyItem` - Provides a class to instantiate
 * - `FactoryDependencyItem` - Provides a factory function
 * - `ExistingDependencyItem` - Aliases another dependency
 * - `ValueDependencyItem` - Provides a static value
 *
 * @template T - The type of the dependency.
 */
export type SyncDependencyItem<T> =
  | ClassDependencyItem<T>
  | FactoryDependencyItem<T>
  | ExistingDependencyItem<T>
  | ValueDependencyItem<T>;

/**
 * Any dependency item, either synchronous or asynchronous.
 *
 * @template T - The type of the dependency.
 */
export type DependencyItem<T> = SyncDependencyItem<T> | AsyncDependencyItem<T>;

export function prettyPrintIdentifier<T>(id: DependencyIdentifier<T>): string {
  return isCtor(id) && !(id as any)[IdentifierDecoratorSymbol]
    ? id.name
    : id.toString();
}
