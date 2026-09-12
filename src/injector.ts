import type {
  Dependency,
  DependencyOrInstance,
  DependencyPair,
} from './dependencyCollection';
import type { DependencyIdentifier } from './dependencyIdentifier';
import type {
  AsyncDependencyItem,
  AsyncHook,
  ClassDependencyItem,
  Ctor,
  DependencyItem,
  ExistingDependencyItem,
  FactoryDependencyItem,
  SyncDependencyItem,
  ValueDependencyItem,
} from './dependencyItem';
import type { IDisposable } from './dispose';
import type {
  InjectorDebugApi,
  InjectorDebugIdentifierGroup,
  InjectorDebugRegistration,
  InjectorDebugResolution,
  InjectorDebugResolutionRequest,
} from './injectorDebug';
import { getSortedDependencies } from './decorators';
import {
  DependencyCollection,
  DependencyNotFoundError,
  DependencyNotFoundForModuleError,
  popupResolvingStack,
  pushResolvingStack,
  ResolvedDependencyCollection,
} from './dependencyCollection';
import { getFactoryDependencies } from './dependencyDescriptor';
import { normalizeForwardRef } from './dependencyForwardRef';
import {
  AsyncHookSymbol,
  isAsyncDependencyItem,
  isAsyncHook,
  isClassDependencyItem,
  isCtor,
  isDependencyItem,
  isExistingDependencyItem,
  isFactoryDependencyItem,
  isValueDependencyItem,
  prettyPrintIdentifier,
} from './dependencyItem';
import { QuantityCheckError } from './dependencyQuantity';
import { RediError } from './error';
import { IdleValue } from './idleValue';
import {
  getDebugDependencies,
  getDebugProviderKind,
  getDebugProviderLabel,
} from './injectorDebugUtils';
import {
  linkInjectorForDiscovery,
  markInjectorDisposedForDiscovery,
  registerInjectorForDiscovery,
} from './injectorDiscovery';
import { LookUp, Quantity } from './types';

const MAX_RESOLUTIONS_QUEUED = 300;

const NotInstantiatedSymbol = Symbol('$$NOT_INSTANTIATED_SYMBOL');
const DetachedInjectorConstruction = Symbol('DetachedInjectorConstruction');

interface ResolutionTarget {
  readonly injector: Injector;
  readonly synthetic?: 'injector';
}

class CircularDependencyError<T> extends RediError {
  constructor(id: DependencyIdentifier<T>) {
    super(
      `Detecting cyclic dependency. The last identifier is "${prettyPrintIdentifier(
        id,
      )}".`,
    );
  }
}

class InjectorAlreadyDisposedError extends RediError {
  constructor() {
    super('Injector cannot be accessed after it was disposed.');
  }
}

class AsyncItemReturnAsyncItemError<T> extends RediError {
  constructor(id: DependencyIdentifier<T>) {
    super(
      `Async item "${prettyPrintIdentifier(id)}" returns another async item.`,
    );
  }
}

class GetAsyncItemFromSyncApiError<T> extends RediError {
  constructor(id: DependencyIdentifier<T>) {
    super(
      `Cannot get async item "${prettyPrintIdentifier(id)}" from sync api.`,
    );
  }
}

class AddDependencyAfterResolutionError<T> extends RediError {
  constructor(id: DependencyIdentifier<T>) {
    super(
      `Cannot add dependency "${prettyPrintIdentifier(
        id,
      )}" after it is already resolved.`,
    );
  }
}

class DeleteDependencyAfterResolutionError<T> extends RediError {
  constructor(id: DependencyIdentifier<T>) {
    super(
      `Cannot delete dependency "${prettyPrintIdentifier(
        id,
      )}" when it is already resolved.`,
    );
  }
}

/**
 * An accessor object that provides limited access to the injector.
 *
 * This interface is passed to the callback in `injector.invoke()`, providing
 * a safe way to access dependencies without exposing the full injector API.
 *
 * @example
 * ```typescript
 * injector.invoke((accessor) => {
 *   const logger = accessor.get(ILogger);
 *   const hasCache = accessor.has(ICacheService);
 * });
 * ```
 */
export interface IAccessor {
  /** Get a dependency by its identifier. */
  get: Injector['get'];
  /** Check if a dependency is available. */
  has: Injector['has'];
}

/**
 * The dependency injection container that manages dependency registration and resolution.
 *
 * The Injector is the core of redi's dependency injection system. It stores
 * dependency registrations and creates instances when requested.
 *
 * Features:
 * - **Hierarchical injection**: Child injectors can inherit from parent injectors
 * - **Lazy instantiation**: Dependencies are created only when first requested
 * - **Singleton by default**: Each dependency is instantiated once per injector
 * - **Lifecycle management**: Automatically disposes dependencies implementing IDisposable
 *
 * @example
 * ```typescript
 * // Basic usage
 * const injector = new Injector([
 *   [AuthService],
 *   [ILogger, { useClass: ConsoleLogger }],
 *   ['API_URL', { useValue: 'https://api.example.com' }],
 * ]);
 *
 * const auth = injector.get(AuthService);
 * const logger = injector.get(ILogger);
 *
 * // Hierarchical injectors
 * const childInjector = injector.createChild([
 *   [ILogger, { useClass: FileLogger }], // Override parent's logger
 * ]);
 *
 * // Clean up when done
 * injector.dispose();
 * ```
 */
export class Injector {
  /**
   * Create a parent-aware Injector without attaching it to the parent's owned
   * children or global Discovery until `attach()` is called. Renderer
   * integrations use this for speculative work that may never commit.
   *
   * @internal
   */
  public static createDetached(
    dependencies?: Dependency[],
    parent: Injector | null = null,
  ): Readonly<{ attach: () => boolean; injector: Injector }> {
    const injector = Reflect.construct(Injector, [
      dependencies,
      parent,
      DetachedInjectorConstruction,
    ]) as Injector;
    return Object.freeze({
      attach: () => injector._attachLifecycle(),
      injector,
    });
  }

  private readonly dependencyCollection: DependencyCollection;
  private readonly resolvedDependencyCollection: ResolvedDependencyCollection;

  private readonly asyncLoadedItems = new Map<
    DependencyIdentifier<any>,
    Map<number, SyncDependencyItem<any>>
  >();

  private readonly asyncPendingPromises = new Map<
    DependencyIdentifier<any>,
    Map<number, Promise<any>>
  >();

  private readonly debugGroupIds = new Map<DependencyIdentifier<any>, string>();

  private nextDebugGroupId = 1;

  /** Side-effect-free APIs intended for developer tooling, not business logic. */
  public readonly debug: InjectorDebugApi;

  private readonly children: Injector[] = [];

  private lifecycleAttached = false;

  private resolutionOngoing = 0;

  private disposingCallbacks = new Set<() => void>();

  private disposed = false;

  /**
   * Create a new `Injector` instance.
   *
   * @param dependencies - An array of dependencies to register with this injector.
   *   Each dependency can be:
   *   - `[ClassName]` - Register a class as its own identifier
   *   - `[Identifier, DependencyItem]` - Register with a specific identifier and configuration
   * @param parent - Optional parent injector for hierarchical injection.
   *   Child injectors inherit dependencies from their parent.
   *
   * @example
   * ```typescript
   * // Root injector
   * const rootInjector = new Injector([
   *   [AuthService],
   *   [ILogger, { useClass: ConsoleLogger }],
   * ]);
   *
   * // Child injector with parent
   * const childInjector = new Injector(
   *   [[ICache, { useClass: MemoryCache }]],
   *   rootInjector
   * );
   * ```
   */
  constructor(
    dependencies?: Dependency[],
    private readonly parent: Injector | null = null,
  ) {
    // eslint-disable-next-line prefer-rest-params -- private construction token
    const detached = arguments[2] === DetachedInjectorConstruction;
    this.dependencyCollection = new DependencyCollection(dependencies || []);
    this.resolvedDependencyCollection = new ResolvedDependencyCollection();
    this.debug = Object.freeze({
      explain: <T>(request: InjectorDebugResolutionRequest<T>) =>
        this._debugExplain(request),
      listRegistrations: () => this._debugListRegistrations(),
    });

    if (!detached) {
      this._attachLifecycle();
    }
  }

  private _attachLifecycle(): boolean {
    if (this.disposed) return false;
    if (this.lifecycleAttached) return true;
    if (this.parent?.disposed) throw new InjectorAlreadyDisposedError();

    if (this.parent) {
      this.parent.children.push(this);
      linkInjectorForDiscovery(this, this.parent);
    } else {
      registerInjectorForDiscovery(this);
    }
    this.lifecycleAttached = true;
    return true;
  }

  /**
   * Register a callback to be called when this injector is disposed.
   *
   * Use this to perform cleanup tasks or release external resources
   * when the injector lifecycle ends.
   *
   * **Note:** When your callback is invoked, the injector is already disposed
   * and you cannot interact with it anymore.
   *
   * @param callback - The function to call when the injector is disposed.
   * @returns A disposable that removes the callback when disposed.
   *
   * @example
   * ```typescript
   * const cleanup = injector.onDispose(() => {
   *   console.log('Injector disposed, cleaning up...');
   * });
   *
   * // Later, remove the callback if no longer needed
   * cleanup.dispose();
   * ```
   */
  public onDispose(callback: () => void): IDisposable {
    this.disposingCallbacks.add(callback);
    return { dispose: () => this.disposingCallbacks.delete(callback) };
  }

  /**
   * Create a child injector that inherits from this injector.
   *
   * The child injector can:
   * - Access all dependencies registered in parent injectors
   * - Override parent dependencies with its own registrations
   * - Have its own scoped dependencies
   *
   * When the parent injector is disposed, all child injectors are disposed first.
   *
   * @param dependencies - Dependencies to register with the child injector.
   * @returns The newly created child injector.
   *
   * @example
   * ```typescript
   * const rootInjector = new Injector([[ILogger, { useClass: ConsoleLogger }]]);
   *
   * const requestInjector = rootInjector.createChild([
   *   [RequestContext, { useClass: RequestContext }],
   * ]);
   *
   * // requestInjector can access both RequestContext and ILogger
   * ```
   */
  public createChild(dependencies?: Dependency[]): Injector {
    this._ensureInjectorNotDisposed();

    return new Injector(dependencies, this);
  }

  /**
   * Dispose the injector and release all resources.
   *
   * This method:
   * 1. Recursively disposes all child injectors first
   * 2. Calls `dispose()` on all instantiated dependencies that implement `IDisposable`
   * 3. Clears all internal collections
   * 4. Detaches from parent injector
   * 5. Invokes all registered `onDispose` callbacks
   *
   * After disposal, the injector cannot be used anymore.
   *
   * @example
   * ```typescript
   * const injector = new Injector([[DatabaseService]]);
   * const db = injector.get(DatabaseService);
   *
   * // When done with the injector
   * injector.dispose(); // DatabaseService.dispose() is called automatically
   * ```
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    // Dispose child injectors first.
    // Iterate over a copy because each child removes itself from this array.
    [...this.children].forEach((c) => c.dispose());
    this.children.length = 0;

    // Call `dispose` method on each instantiated dependencies if they are `IDisposable` and clear collections.
    this.dependencyCollection.dispose();
    this.resolvedDependencyCollection.dispose();
    this.asyncLoadedItems.clear();
    this.asyncPendingPromises.clear();

    // Detach itself from parent.
    this.deleteSelfFromParent();

    this.disposed = true;
    markInjectorDisposedForDiscovery(this);

    this.disposingCallbacks.forEach((callback) => callback());
    this.disposingCallbacks.clear();
  }

  private deleteSelfFromParent(): void {
    if (this.parent && this.lifecycleAttached) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) {
        this.parent.children.splice(index, 1);
      }
    }
    this.lifecycleAttached = false;
  }

  /**
   * Add a dependency or pre-created instance to the injector at runtime.
   *
   * This allows dynamic registration of dependencies after the injector is created.
   * Throws an error if the dependency has already been instantiated.
   *
   * @param dependency - A tuple containing:
   *   - `[Ctor]` - A class to register as its own identifier
   *   - `[Identifier, DependencyItem]` - An identifier with its configuration
   *   - `[Identifier, Instance]` - An identifier with a pre-created instance
   *
   * @throws {AddDependencyAfterResolutionError} If the dependency is already resolved.
   *
   * @example
   * ```typescript
   * const injector = new Injector();
   *
   * // Add a class
   * injector.add([MyService]);
   *
   * // Add with configuration
   * injector.add([ILogger, { useClass: ConsoleLogger }]);
   *
   * // Add a pre-created instance
   * const config = { apiUrl: 'https://api.example.com' };
   * injector.add([IConfig, config]);
   * ```
   */
  public add<T>(dependency: DependencyOrInstance<T>): void {
    this._ensureInjectorNotDisposed();

    const identifierOrCtor = dependency[0];
    const item = dependency[1];

    if (this.resolvedDependencyCollection.has(identifierOrCtor)) {
      throw new AddDependencyAfterResolutionError(identifierOrCtor);
    }

    if (typeof item === 'undefined') {
      // Add dependency
      this.dependencyCollection.add(identifierOrCtor as Ctor<T>);
    } else if (isDependencyItem(item)) {
      // Add dependency
      this.dependencyCollection.add(
        identifierOrCtor,
        item as DependencyItem<T>,
      );
    } else {
      // Add instance
      this.resolvedDependencyCollection.add(identifierOrCtor, item as T);
    }
  }

  /**
   * Replace an existing dependency registration.
   *
   * Use this to swap out an implementation, typically for testing purposes.
   * Throws an error if the dependency has already been instantiated.
   *
   * @param dependency - A tuple of `[Identifier, DependencyItem]` to replace the existing registration.
   *
   * @throws {AddDependencyAfterResolutionError} If the dependency is already resolved.
   *
   * @example
   * ```typescript
   * // In tests, replace a real service with a mock
   * injector.replace([IHttpClient, { useClass: MockHttpClient }]);
   * ```
   */
  public replace<T>(dependency: DependencyPair<T>): void {
    this._ensureInjectorNotDisposed();

    const identifier = dependency[0];
    if (this.resolvedDependencyCollection.has(identifier)) {
      throw new AddDependencyAfterResolutionError(identifier);
    }

    this.dependencyCollection.delete(identifier);
    this.dependencyCollection.add(identifier, dependency[1]);
  }

  /**
   * Remove a dependency registration from the injector.
   *
   * Throws an error if the dependency has already been instantiated.
   *
   * @param identifier - The identifier of the dependency to remove.
   *
   * @throws {DeleteDependencyAfterResolutionError} If the dependency is already resolved.
   *
   * @example
   * ```typescript
   * injector.delete(ITemporaryService);
   * ```
   */
  public delete<T>(identifier: DependencyIdentifier<T>): void {
    this._ensureInjectorNotDisposed();

    if (this.resolvedDependencyCollection.has(identifier)) {
      throw new DeleteDependencyAfterResolutionError(identifier);
    }

    this.dependencyCollection.delete(identifier);
  }

  /**
   * Execute a function with controlled access to the injector.
   *
   * The callback receives an `IAccessor` that provides limited access to
   * the injector's `get` and `has` methods. This is useful for service locator
   * patterns or when you need to resolve dependencies dynamically.
   *
   * @param cb - The function to execute. Receives an accessor and any additional arguments.
   * @param args - Additional arguments to pass to the callback.
   * @returns The return value of the callback function.
   *
   * @example
   * ```typescript
   * const result = injector.invoke((accessor, multiplier) => {
   *   const calc = accessor.get(ICalculator);
   *   return calc.compute() * multiplier;
   * }, 2);
   * ```
   */
  invoke<T, P extends any[] = []>(
    cb: (accessor: IAccessor, ...args: P) => T,
    ...args: P
  ): T {
    this._ensureInjectorNotDisposed();

    const accessor: IAccessor = {
      get: <D>(
        id: DependencyIdentifier<D>,
        quantityOrLookup?: Quantity | LookUp,
        lookUp?: LookUp,
      ) => {
        return this._get(id, quantityOrLookup, lookUp);
      },

      has: <D>(id: DependencyIdentifier<D>): boolean => {
        return this.has(id);
      },
    };

    return cb(accessor, ...args);
  }

  /**
   * Check if a dependency is registered in this injector or any parent injector.
   *
   * @param id - The identifier of the dependency to check.
   * @returns `true` if the dependency is registered, `false` otherwise.
   *
   * @example
   * ```typescript
   * if (injector.has(IOptionalFeature)) {
   *   const feature = injector.get(IOptionalFeature);
   *   feature.enable();
   * }
   * ```
   */
  public has<T>(id: DependencyIdentifier<T>): boolean {
    return this.dependencyCollection.has(id) || this.parent?.has(id) || false;
  }

  public get<T>(id: DependencyIdentifier<T>, lookUp?: LookUp): T;
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.MANY,
    lookUp?: LookUp,
  ): T[];
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.OPTIONAL,
    lookUp?: LookUp,
  ): T | null;
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.REQUIRED,
    lookUp?: LookUp,
  ): T;
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity?: Quantity,
    lookUp?: LookUp,
  ): T[] | T | null;
  public get<T>(
    id: DependencyIdentifier<T>,
    quantityOrLookup?: Quantity | LookUp,
    lookUp?: LookUp,
  ): T[] | T | null;
  /**
   * Retrieve a dependency instance from the injector.
   *
   * The dependency will be instantiated on first access and cached for subsequent requests.
   * If the dependency is not found and not optional, an error is thrown.
   *
   * @param id - The identifier of the dependency to retrieve.
   * @param quantityOrLookup - Either a {@link Quantity} specifying how many instances to get,
   *   or a {@link LookUp} specifying where to search.
   * @param lookUp - A {@link LookUp} specifying where to search (if first param is Quantity).
   * @returns The dependency instance, an array of instances (for `Quantity.MANY`),
   *   or `null` (for `Quantity.OPTIONAL` when not found).
   *
   * @throws {DependencyNotFoundError} If the dependency is not registered and not optional.
   * @throws {GetAsyncItemFromSyncApiError} If trying to get an async dependency synchronously.
   *
   * @example
   * ```typescript
   * // Get a required dependency
   * const logger = injector.get(ILogger);
   *
   * // Get an optional dependency
   * const cache = injector.get(ICache, Quantity.OPTIONAL);
   *
   * // Get all registered handlers
   * const handlers = injector.get(IHandler, Quantity.MANY);
   *
   * // Only search current injector
   * const localService = injector.get(IService, LookUp.SELF);
   * ```
   */
  public get<T>(
    id: DependencyIdentifier<T>,
    quantityOrLookup?: Quantity | LookUp,
    lookUp?: LookUp,
  ): T[] | T | null {
    this._ensureInjectorNotDisposed();

    const normalized = this._normalizeResolutionOptions(
      quantityOrLookup,
      lookUp,
    );
    if (this._wouldResolveAsync(id, normalized.quantity, normalized.lookUp)) {
      throw new GetAsyncItemFromSyncApiError(id);
    }

    const result = this._get(id, quantityOrLookup, lookUp);
    if (
      (Array.isArray(result) && result.some((item) => isAsyncHook(item))) ||
      isAsyncHook(result)
    ) {
      throw new GetAsyncItemFromSyncApiError(id);
    }

    return result as T | T[] | null;
  }

  private _get<T>(
    id: DependencyIdentifier<T>,
    quantityOrLookup?: Quantity | LookUp,
    lookUp?: LookUp,
    withNew?: boolean,
  ): T[] | T | AsyncHook<T> | null {
    const normalized = this._normalizeResolutionOptions(
      quantityOrLookup,
      lookUp,
    );
    const { quantity } = normalized;
    lookUp = normalized.lookUp;

    if (!withNew) {
      // see if the dependency is already resolved, return it and check quantity
      // if the dependency is not registered, it will return null or [] based on the quantity
      const cachedResult = this.getValue(id, quantity, lookUp);
      if (cachedResult !== NotInstantiatedSymbol) {
        return cachedResult;
      }
    }

    // see if the dependency can be instantiated by itself or its parent
    const shouldCache = !withNew;
    return this.createDependency(id, quantity, lookUp, shouldCache) as
      | T[]
      | T
      | AsyncHook<T>
      | null;
  }

  /**
   * Get a dependency in the async way.
   */
  public getAsync<T>(id: DependencyIdentifier<T>): Promise<T> {
    this._ensureInjectorNotDisposed();

    const cachedResult = this.getValue(id, Quantity.REQUIRED);
    if (cachedResult !== NotInstantiatedSymbol) {
      return Promise.resolve(cachedResult as T);
    }

    const newResult = this.createDependency(id, Quantity.REQUIRED);
    if (!isAsyncHook(newResult)) {
      return Promise.resolve(newResult as T);
    }

    return newResult.whenReady();
  }

  /**
   * Create an instance of a class with its dependencies injected.
   *
   * Unlike `get()`, the created instance is NOT cached by the injector.
   * Each call creates a new instance. You can also pass custom arguments
   * that will be passed before the injected dependencies.
   *
   * @param ctor - The class constructor to instantiate.
   * @param customArgs - Custom arguments to pass before injected dependencies.
   * @returns A new instance of the class.
   *
   * @example
   * ```typescript
   * class RequestHandler {
   *   constructor(
   *     requestId: string,           // Custom arg
   *     @Inject(ILogger) logger: ILogger  // Injected
   *   ) {}
   * }
   *
   * // Create instance with custom requestId
   * const handler = injector.createInstance(RequestHandler, 'req-123');
   * ```
   */
  public createInstance<T extends unknown[], U extends unknown[], C>(
    ctor: new (...args: [...T, ...U]) => C,
    ...customArgs: T
  ): C {
    this._ensureInjectorNotDisposed();

    return this._resolveClassImpl(
      {
        useClass: ctor as Ctor<C>,
      },
      ...customArgs,
    );
  }

  private _resolveDependency<T>(
    id: DependencyIdentifier<T>,
    item: DependencyItem<T>,
    shouldCache = true,
    registrationId?: number,
  ): T | AsyncHook<T> {
    return this._resolveDependencyItem(id, item, shouldCache, registrationId);
  }

  private _resolveDependencyItem<T>(
    id: DependencyIdentifier<T>,
    item: DependencyItem<T>,
    shouldCache: boolean,
    registrationId?: number,
  ): T | AsyncHook<T> {
    let result: T | AsyncHook<T>;

    pushResolvingStack(id);

    try {
      if (isValueDependencyItem(item)) {
        result = this._resolveValueDependency(
          id,
          item as ValueDependencyItem<T>,
          shouldCache,
          registrationId,
        );
      } else if (isFactoryDependencyItem(item)) {
        result = this._resolveFactory(
          id,
          item as FactoryDependencyItem<T>,
          shouldCache,
          registrationId,
        );
      } else if (isClassDependencyItem(item)) {
        result = this._resolveClass(
          id,
          item as ClassDependencyItem<T>,
          shouldCache,
          registrationId,
        );
      } else if (isExistingDependencyItem(item)) {
        result = this._resolveExisting(
          id,
          item as ExistingDependencyItem<T>,
          shouldCache,
          registrationId,
        );
      } else {
        result = this._resolveAsync(
          id,
          item as AsyncDependencyItem<T>,
          registrationId,
        );
      }

      popupResolvingStack();
    } catch (e: unknown) {
      popupResolvingStack();
      throw e;
    }

    return result;
  }

  private _resolveExisting<T>(
    id: DependencyIdentifier<T>,
    item: ExistingDependencyItem<T>,
    shouldCache: boolean,
    registrationId?: number,
  ): T {
    const thing = this.get(normalizeForwardRef(item.useExisting));
    if (shouldCache) {
      this.resolvedDependencyCollection.add(id, thing, registrationId);
    }
    return thing;
  }

  private _resolveValueDependency<T>(
    id: DependencyIdentifier<T>,
    item: ValueDependencyItem<T>,
    shouldCache: boolean,
    registrationId?: number,
  ): T {
    const thing = item.useValue;
    if (shouldCache) {
      this.resolvedDependencyCollection.add(id, thing, registrationId);
    }
    return thing;
  }

  private _resolveClass<T>(
    id: DependencyIdentifier<T> | null,
    item: ClassDependencyItem<T>,
    shouldCache: boolean,
    registrationId?: number,
  ): T {
    let thing: T;

    if (item.lazy) {
      const idle = new IdleValue<T>(() => {
        this._ensureInjectorNotDisposed();
        return this._resolveClassImpl(item);
      });

      thing = new Proxy(Object.create(null), {
        get(target: any, key: string | number | symbol): any {
          if (key in target) {
            return target[key]; // such as toString
          }

          // this seems not necessary
          // // hack checking if it's a async loader
          // if (key === 'whenReady') {
          //   return undefined;
          // }

          // `Injector.dispose()` checks `isDisposable(item)` on every
          // resolved dependency, which reads this exact property. Without
          // this guard that read alone would fall through to
          // `idle.getValue()` below and force-construct the real instance --
          // defeating the point of `lazy: true` (avoid work that's never
          // needed) and running its constructor's side effects (e.g. opening
          // a connection) only to immediately dispose of it again. If the
          // idle construction hasn't run yet, just cancel it instead:
          // there's nothing real to dispose of, so nothing needs disposing.
          if (key === 'dispose' && !idle.hasRun()) {
            return () => idle.dispose();
          }

          const thing = idle.getValue();

          let property = (thing as any)[key];
          if (typeof property !== 'function') {
            return property;
          }

          property = property.bind(thing);
          target[key] = property;

          return property;
        },
        set(_target: any, key: string | number | symbol, value: any): boolean {
          (idle.getValue() as any)[key] = value;
          return true;
        },
      });
    } else {
      thing = this._resolveClassImpl(item);
    }

    if (id && shouldCache) {
      this.resolvedDependencyCollection.add(id, thing, registrationId);
    }

    return thing;
  }

  private _resolveClassImpl<T>(
    item: ClassDependencyItem<T>,
    ...extraParams: any[]
  ) {
    const Ctor = item.useClass;
    this.markNewResolution(Ctor);

    const declaredDependencies = getSortedDependencies(Ctor);

    const resolvedArgs: any[] = [];

    for (const dep of declaredDependencies) {
      // recursive happens here
      try {
        const thing = this._get(
          dep.identifier,
          dep.quantity,
          dep.lookUp,
          dep.withNew,
        );
        resolvedArgs.push(thing);
      } catch (error: unknown) {
        if (
          error instanceof DependencyNotFoundError ||
          (error instanceof QuantityCheckError && error.actual === 0)
        ) {
          throw new DependencyNotFoundForModuleError(
            Ctor,
            dep.identifier,
            dep.paramIndex,
          );
        }

        throw error;
      }
    }

    let args = extraParams;
    const firstDependencyArgIndex =
      declaredDependencies.length > 0
        ? declaredDependencies[0].paramIndex
        : args.length;

    if (args.length !== firstDependencyArgIndex) {
      console.warn(
        `[redi]: Expect ${firstDependencyArgIndex} custom parameter(s) of ${prettyPrintIdentifier(Ctor)} but get ${
          args.length
        }.`,
      );

      const delta = firstDependencyArgIndex - args.length;
      if (delta > 0) {
        args = [...args, ...Array.from({ length: delta }).fill(undefined)];
      } else {
        args = args.slice(0, firstDependencyArgIndex);
      }
    }

    const thing = new Ctor(...args, ...resolvedArgs);

    item?.onInstantiation?.(thing);

    this.markResolutionCompleted();

    return thing;
  }

  private _resolveFactory<T>(
    id: DependencyIdentifier<T>,
    item: FactoryDependencyItem<T>,
    shouldCache: boolean,
    registrationId?: number,
  ): T {
    this.markNewResolution(id);

    const declaredDependencies = getFactoryDependencies(item);

    const resolvedArgs: any[] = [];
    for (const dep of declaredDependencies) {
      try {
        const thing = this._get(
          dep.identifier,
          dep.quantity,
          dep.lookUp,
          dep.withNew,
        );
        resolvedArgs.push(thing);
      } catch (error: unknown) {
        if (
          error instanceof DependencyNotFoundError ||
          (error instanceof QuantityCheckError && error.actual === 0)
        ) {
          throw new DependencyNotFoundForModuleError(
            id,
            dep.identifier,
            dep.paramIndex,
          );
        }

        // should throw the error (user should handle it)
        throw error;
      }
    }

    const thing = item.useFactory.apply(null, resolvedArgs);

    if (shouldCache) {
      this.resolvedDependencyCollection.add(id, thing, registrationId);
    }

    this.markResolutionCompleted();

    item?.onInstantiation?.(thing);

    return thing;
  }

  private _resolveAsync<T>(
    id: DependencyIdentifier<T>,
    item: AsyncDependencyItem<T>,
    registrationId?: number,
  ): AsyncHook<T> {
    const asyncLoader: AsyncHook<T> = {
      __symbol: AsyncHookSymbol,
      whenReady: () => this._resolveAsyncImpl(id, item, registrationId),
    };
    return asyncLoader;
  }

  private _resolveAsyncImpl<T>(
    id: DependencyIdentifier<T>,
    item: AsyncDependencyItem<T>,
    registrationId?: number,
  ): Promise<T> {
    const resolvedRegistrationId = registrationId ?? -1;
    const pending = this.asyncPendingPromises
      .get(id)
      ?.get(resolvedRegistrationId);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = Promise.resolve()
      .then(() => item.useAsync())
      .then((thing) => {
        // Do not resolve the same registration again if another path won first.
        const resolvedEntry =
          this.resolvedDependencyCollection.getResolvedRegistration(
            id,
            resolvedRegistrationId,
          );
        if (resolvedEntry) {
          return resolvedEntry.value as T;
        }

        let loadedItem: SyncDependencyItem<T>;
        let ret: T;
        if (Array.isArray(thing)) {
          loadedItem = thing[1];
          if (isAsyncDependencyItem(loadedItem)) {
            throw new AsyncItemReturnAsyncItemError(id);
          }
          ret = this._resolveDependencyItem(id, loadedItem, false) as T;
        } else if (isCtor(thing)) {
          loadedItem = {
            useClass: thing,
            onInstantiation: item.onInstantiation,
          };
          ret = this._resolveClassImpl(loadedItem);
        } else {
          loadedItem = { useValue: thing };
          ret = thing;
        }

        let loadedItems = this.asyncLoadedItems.get(id);
        if (!loadedItems) {
          loadedItems = new Map();
          this.asyncLoadedItems.set(id, loadedItems);
        }
        loadedItems.set(resolvedRegistrationId, loadedItem);
        this.resolvedDependencyCollection.add(id, ret, resolvedRegistrationId);

        return ret;
      })
      .finally(() => {
        const pendingByRegistration = this.asyncPendingPromises.get(id);
        pendingByRegistration?.delete(resolvedRegistrationId);
        if (pendingByRegistration && pendingByRegistration.size === 0) {
          this.asyncPendingPromises.delete(id);
        }
      });

    let pendingByRegistration = this.asyncPendingPromises.get(id);
    if (!pendingByRegistration) {
      pendingByRegistration = new Map();
      this.asyncPendingPromises.set(id, pendingByRegistration);
    }
    pendingByRegistration.set(resolvedRegistrationId, promise);
    return promise;
  }

  private getValue<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity = Quantity.REQUIRED,
    lookUp?: LookUp,
  ): null | T | T[] | typeof NotInstantiatedSymbol {
    const target = this._findResolutionTarget(id, lookUp, true);
    if (!target) {
      if (quantity === Quantity.OPTIONAL) return null;
      if (quantity === Quantity.MANY) return [];
      throw new QuantityCheckError(id, Quantity.REQUIRED, 0);
    }

    if (target.synthetic === 'injector') {
      if (quantity === Quantity.MANY) {
        return [target.injector as unknown as T];
      }
      return target.injector as unknown as T;
    }

    if (
      target.injector.dependencyCollection.has(id) &&
      !target.injector.resolvedDependencyCollection.has(id)
    ) {
      return NotInstantiatedSymbol;
    }

    return target.injector.resolvedDependencyCollection.get(id, quantity);
  }

  private createDependency<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
    lookUp?: LookUp,
    shouldCache = true,
  ): null | T | T[] | AsyncHook<T> | (T | AsyncHook<T>)[] {
    const target = this._findResolutionTarget(id, lookUp, false);
    if (!target) {
      if (quantity === Quantity.OPTIONAL) return null;
      if (quantity === Quantity.MANY) return [];

      pushResolvingStack(id);
      throw new DependencyNotFoundError(id);
    }

    if (target.synthetic === 'injector') {
      if (quantity === Quantity.MANY) {
        return [target.injector as unknown as T];
      }
      return target.injector as unknown as T;
    }

    const registrations = target.injector.dependencyCollection.getRegistrations(
      id,
      quantity,
    )!;
    const registrationIds =
      target.injector.dependencyCollection.getRegistrationIds(id);
    if (Array.isArray(registrations)) {
      return registrations.map((item, index) =>
        target.injector._resolveDependency(
          id,
          item,
          shouldCache,
          registrationIds[index],
        ),
      );
    }

    return target.injector._resolveDependency(
      id,
      registrations,
      shouldCache,
      registrationIds[0],
    );
  }

  private _normalizeResolutionOptions(
    quantityOrLookup?: Quantity | LookUp,
    lookUp?: LookUp,
  ): { lookUp?: LookUp; quantity: Quantity } {
    if (
      quantityOrLookup === Quantity.REQUIRED ||
      quantityOrLookup === Quantity.OPTIONAL ||
      quantityOrLookup === Quantity.MANY
    ) {
      return { lookUp, quantity: quantityOrLookup };
    }

    return {
      lookUp: quantityOrLookup as LookUp | undefined,
      quantity: Quantity.REQUIRED,
    };
  }

  /** Shared target selection for recursive resolution and Resolution Explain. */
  private _findResolutionTarget<T>(
    id: DependencyIdentifier<T>,
    lookUp: LookUp | undefined,
    includeResolved: boolean,
  ): ResolutionTarget | null {
    let current = lookUp === LookUp.SKIP_SELF ? this.parent : this;
    const selfOnly = lookUp === LookUp.SELF;

    while (current) {
      if ((id as unknown) === Injector) {
        return { injector: current, synthetic: 'injector' };
      }

      if (
        current.dependencyCollection.has(id) ||
        (includeResolved && current.resolvedDependencyCollection.has(id))
      ) {
        return { injector: current };
      }

      if (selfOnly) break;
      current = current.parent;
    }

    return null;
  }

  private _wouldResolveAsync<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
    lookUp: LookUp | undefined,
  ): boolean {
    const target = this._findResolutionTarget(id, lookUp, true);
    if (
      !target ||
      target.synthetic ||
      target.injector.resolvedDependencyCollection.has(id)
    ) {
      return false;
    }

    const items = target.injector.dependencyCollection.peek(id);
    if (!items) return false;

    if (quantity !== Quantity.MANY && items.length !== 1) {
      return false;
    }

    return items.some((item) => isAsyncDependencyItem(item));
  }

  private _debugGroupId(identifier: DependencyIdentifier<any>): string {
    let id = this.debugGroupIds.get(identifier);
    if (!id) {
      id = `group-${this.nextDebugGroupId}`;
      this.nextDebugGroupId += 1;
      this.debugGroupIds.set(identifier, id);
    }
    return id;
  }

  private _debugListRegistrations(): readonly InjectorDebugIdentifierGroup[] {
    const dependencySnapshot = this.dependencyCollection.snapshot();
    const resolvedSnapshot = this.resolvedDependencyCollection.snapshot();
    const resolvedByIdentifier = new Map(resolvedSnapshot);
    const identifiers = dependencySnapshot.map(([identifier]) => identifier);
    for (const [identifier] of resolvedSnapshot) {
      if (!identifiers.includes(identifier)) identifiers.push(identifier);
    }

    return identifiers.map((identifier) => {
      const declaredRegistrations =
        dependencySnapshot.find(
          ([candidate]) => candidate === identifier,
        )?.[1] ?? [];
      const resolved = resolvedByIdentifier.get(identifier) ?? [];
      const declaredRegistrationIds =
        this.dependencyCollection.getRegistrationIds(identifier);
      const declaredIds = new Set(declaredRegistrationIds);
      const registrations: InjectorDebugRegistration[] =
        declaredRegistrations.map((item, registrationIndex) => {
          const registrationId = declaredRegistrationIds[registrationIndex];
          const loadedItem = isAsyncDependencyItem(item)
            ? this.asyncLoadedItems.get(identifier)?.get(registrationId)
            : undefined;
          const loadedProviderKind = loadedItem
            ? getDebugProviderKind(loadedItem)
            : undefined;
          const providerLabel = loadedItem
            ? `async to ${getDebugProviderLabel(loadedItem)}`
            : getDebugProviderLabel(item);

          return Object.freeze({
            id: String(registrationId),
            dependencies: getDebugDependencies(item, loadedItem),
            ...(isFactoryDependencyItem(item) && item.dynamic
              ? { dynamic: true as const }
              : {}),
            identifier,
            identifierLabel: prettyPrintIdentifier(identifier),
            ...(isClassDependencyItem(item) && item.lazy
              ? { lazy: true as const }
              : {}),
            ...(loadedProviderKind ? { loadedProviderKind } : {}),
            providerKind: getDebugProviderKind(item),
            providerLabel,
            status: this.resolvedDependencyCollection.hasResolvedRegistration(
              identifier,
              registrationId,
            )
              ? ('created' as const)
              : isAsyncDependencyItem(item)
                ? ('pending' as const)
                : ('not-created' as const),
          });
        });

      for (const resolvedEntry of resolved) {
        if (declaredIds.has(resolvedEntry.registrationId)) continue;
        registrations.push(
          Object.freeze({
            id: String(resolvedEntry.registrationId),
            dependencies: Object.freeze([]),
            identifier,
            identifierLabel: prettyPrintIdentifier(identifier),
            providerKind: 'instance' as const,
            providerLabel: 'instance',
            status: 'created' as const,
          }),
        );
      }

      return Object.freeze({
        id: this._debugGroupId(identifier),
        identifier,
        identifierLabel: prettyPrintIdentifier(identifier),
        registrations: Object.freeze(registrations),
      });
    });
  }

  private _debugExplain<T>(
    request: InjectorDebugResolutionRequest<T>,
  ): InjectorDebugResolution<T> {
    const normalizedRequest = Object.freeze({
      identifier: request.identifier,
      lookUp: request.lookUp,
      quantity: request.quantity ?? Quantity.REQUIRED,
      withNew: request.withNew ?? false,
    });
    const target = this._findResolutionTarget(
      request.identifier,
      request.lookUp,
      !normalizedRequest.withNew,
    );

    if (!target) {
      const outcome =
        normalizedRequest.quantity === Quantity.OPTIONAL
          ? ('optional-missing' as const)
          : normalizedRequest.quantity === Quantity.MANY
            ? ('many-empty' as const)
            : ('required-missing' as const);
      return { landing: null, outcome, request: normalizedRequest };
    }

    if (target.synthetic === 'injector') {
      return {
        landing: {
          groupId: target.injector._debugGroupId(Injector),
          injector: target.injector,
          registrationIds: Object.freeze([]),
          synthetic: 'injector',
        },
        outcome: 'resolved',
        request: normalizedRequest,
      };
    }

    const resolvedEntries =
      target.injector.resolvedDependencyCollection.entries(request.identifier);
    const hasResolved =
      !normalizedRequest.withNew && resolvedEntries.length > 0;
    const declaredRegistrationIds =
      target.injector.dependencyCollection.getRegistrationIds(
        request.identifier,
      );
    const registrationIds: string[] = hasResolved
      ? resolvedEntries.map((entry) => String(entry.registrationId))
      : declaredRegistrationIds.map((registrationId) => String(registrationId));
    const actual = registrationIds.length;
    const landing = {
      groupId: target.injector._debugGroupId(request.identifier),
      injector: target.injector,
      registrationIds: Object.freeze(
        registrationIds.slice(
          0,
          normalizedRequest.quantity === Quantity.MANY ? actual : 1,
        ),
      ),
    };
    const quantityMismatch =
      (normalizedRequest.quantity === Quantity.REQUIRED && actual !== 1) ||
      (normalizedRequest.quantity === Quantity.OPTIONAL && actual > 1);

    if (quantityMismatch) {
      return {
        actual,
        landing: {
          ...landing,
          registrationIds: Object.freeze(registrationIds),
        },
        outcome: 'quantity-mismatch',
        request: normalizedRequest,
      };
    }

    return {
      landing,
      outcome: 'resolved',
      request: normalizedRequest,
    };
  }

  private markNewResolution<T>(id: DependencyIdentifier<T>): void {
    this.resolutionOngoing += 1;

    if (this.resolutionOngoing >= MAX_RESOLUTIONS_QUEUED) {
      throw new CircularDependencyError(id);
    }
  }

  private markResolutionCompleted(): void {
    this.resolutionOngoing -= 1;
  }

  private _ensureInjectorNotDisposed(): void {
    if (this.disposed) {
      throw new InjectorAlreadyDisposedError();
    }
  }
}
