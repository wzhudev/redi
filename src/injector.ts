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
  ValueDependencyItem,
} from './dependencyItem';
import type { IDisposable } from './dispose';
import { getDependencies } from './decorators';
import {
  DependencyCollection,
  DependencyNotFoundError,
  DependencyNotFoundForModuleError,
  popupResolvingStack,
  pushResolvingStack,
  ResolvedDependencyCollection,
} from './dependencyCollection';
import { normalizeFactoryDeps } from './dependencyDescriptor';
import { normalizeForwardRef } from './dependencyForwardRef';
import {
  AsyncHookSymbol,
  isAsyncDependencyItem,
  isAsyncHook,
  isClassDependencyItem,
  isCtor,
  isExistingDependencyItem,
  isFactoryDependencyItem,
  isValueDependencyItem,
  prettyPrintIdentifier,
} from './dependencyItem';
import { QuantityCheckError } from './dependencyQuantity';
import { RediError } from './error';
import { IdleValue } from './idleValue';
import { LookUp, Quantity } from './types';

const MAX_RESOLUTIONS_QUEUED = 300;

const NotInstantiatedSymbol = Symbol('$$NOT_INSTANTIATED_SYMBOL');

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
  private readonly dependencyCollection: DependencyCollection;
  private readonly resolvedDependencyCollection: ResolvedDependencyCollection;

  private readonly children: Injector[] = [];

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
    this.dependencyCollection = new DependencyCollection(dependencies || []);
    this.resolvedDependencyCollection = new ResolvedDependencyCollection();

    if (parent) {
      parent.children.push(this);
    }
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
    // Dispose child injectors first.
    this.children.forEach((c) => c.dispose());
    this.children.length = 0;

    // Call `dispose` method on each instantiated dependencies if they are `IDisposable` and clear collections.
    this.dependencyCollection.dispose();
    this.resolvedDependencyCollection.dispose();

    // Detach itself from parent.
    this.deleteSelfFromParent();

    this.disposed = true;

    this.disposingCallbacks.forEach((callback) => callback());
    this.disposingCallbacks.clear();
  }

  private deleteSelfFromParent(): void {
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      this.parent.children.splice(index, 1);
    }
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
    } else if (
      isAsyncDependencyItem(item) ||
      isClassDependencyItem(item) ||
      isValueDependencyItem(item) ||
      isFactoryDependencyItem(item)
    ) {
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

    const newResult = this._get(id, quantityOrLookup, lookUp);
    if (
      (Array.isArray(newResult) && newResult.some((r) => isAsyncHook(r))) ||
      isAsyncHook(newResult)
    ) {
      throw new GetAsyncItemFromSyncApiError(id);
    }

    return newResult as T | T[] | null;
  }

  private _get<T>(
    id: DependencyIdentifier<T>,
    quantityOrLookup?: Quantity | LookUp,
    lookUp?: LookUp,
    withNew?: boolean,
  ): T[] | T | AsyncHook<T> | null {
    let quantity: Quantity = Quantity.REQUIRED;
    if (
      quantityOrLookup === Quantity.REQUIRED ||
      quantityOrLookup === Quantity.OPTIONAL ||
      quantityOrLookup === Quantity.MANY
    ) {
      quantity = quantityOrLookup as Quantity;
    } else {
      lookUp = quantityOrLookup as LookUp;
    }

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
  ): T | AsyncHook<T> {
    let result: T | AsyncHook<T>;

    pushResolvingStack(id);

    try {
      if (isValueDependencyItem(item)) {
        result = this._resolveValueDependency(
          id,
          item as ValueDependencyItem<T>,
        );
      } else if (isFactoryDependencyItem(item)) {
        result = this._resolveFactory(
          id,
          item as FactoryDependencyItem<T>,
          shouldCache,
        );
      } else if (isClassDependencyItem(item)) {
        result = this._resolveClass(
          id,
          item as ClassDependencyItem<T>,
          shouldCache,
        );
      } else if (isExistingDependencyItem(item)) {
        result = this._resolveExisting(id, item as ExistingDependencyItem<T>);
      } else {
        result = this._resolveAsync(id, item as AsyncDependencyItem<T>);
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
  ): T {
    const thing = this.get(item.useExisting);
    this.resolvedDependencyCollection.add(id, thing);
    return thing;
  }

  private _resolveValueDependency<T>(
    id: DependencyIdentifier<T>,
    item: ValueDependencyItem<T>,
  ): T {
    const thing = item.useValue;
    this.resolvedDependencyCollection.add(id, thing);
    return thing;
  }

  private _resolveClass<T>(
    id: DependencyIdentifier<T> | null,
    item: ClassDependencyItem<T>,
    shouldCache: boolean,
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
      this.resolvedDependencyCollection.add(id, thing);
    }

    return thing;
  }

  private _resolveClassImpl<T>(
    item: ClassDependencyItem<T>,
    ...extraParams: any[]
  ) {
    const Ctor = item.useClass;
    this.markNewResolution(Ctor);

    const declaredDependencies = getDependencies(Ctor)
      .sort((a, b) => a.paramIndex - b.paramIndex)
      .map((descriptor) => ({
        ...descriptor,
        identifier: normalizeForwardRef(descriptor.identifier),
      }));

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

    let args = [...extraParams];
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
  ): T {
    this.markNewResolution(id);

    const declaredDependencies = normalizeFactoryDeps(item.deps);

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
      this.resolvedDependencyCollection.add(id, thing);
    }

    this.markResolutionCompleted();

    item?.onInstantiation?.(thing);

    return thing;
  }

  private _resolveAsync<T>(
    id: DependencyIdentifier<T>,
    item: AsyncDependencyItem<T>,
  ): AsyncHook<T> {
    const asyncLoader: AsyncHook<T> = {
      __symbol: AsyncHookSymbol,
      whenReady: () => this._resolveAsyncImpl(id, item),
    };
    return asyncLoader;
  }

  private _resolveAsyncImpl<T>(
    id: DependencyIdentifier<T>,
    item: AsyncDependencyItem<T>,
  ): Promise<T> {
    return item.useAsync().then((thing) => {
      // check if another promise has been resolved,
      // do not resolve the async item twice
      const resolvedCheck = this.getValue(id);
      if (resolvedCheck !== NotInstantiatedSymbol) {
        return resolvedCheck as T;
      }

      let ret: T;
      if (Array.isArray(thing)) {
        const item = thing[1];
        if (isAsyncDependencyItem(item)) {
          throw new AsyncItemReturnAsyncItemError(id);
        } else {
          ret = this._resolveDependency(id, item) as T;
        }
      } else if (isCtor(thing)) {
        ret = this._resolveClassImpl({
          useClass: thing,
          onInstantiation: item.onInstantiation,
        });
      } else {
        ret = thing;
      }

      this.resolvedDependencyCollection.add(id, ret);

      return ret;
    });
  }

  private getValue<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity = Quantity.REQUIRED,
    lookUp?: LookUp,
  ): null | T | T[] | typeof NotInstantiatedSymbol {
    const onSelf = () => {
      if (
        this.dependencyCollection.has(id) &&
        !this.resolvedDependencyCollection.has(id)
      ) {
        return NotInstantiatedSymbol;
      }

      return this.resolvedDependencyCollection.get(id, quantity);
    };

    const onParent = () => {
      if (this.parent) {
        return this.parent.getValue(id, quantity);
      } else {
        if (quantity === Quantity.OPTIONAL) {
          return null;
        } else if (quantity === Quantity.MANY) {
          return [];
        }

        throw new QuantityCheckError(id, Quantity.REQUIRED, 0);
      }
    };

    if (lookUp === LookUp.SKIP_SELF) {
      return onParent();
    }

    if (id === Injector) {
      return this as unknown as T;
    }

    if (lookUp === LookUp.SELF) {
      return onSelf();
    }

    if (
      this.resolvedDependencyCollection.has(id) ||
      this.dependencyCollection.has(id)
    ) {
      return onSelf();
    }

    return onParent();
  }

  private createDependency<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
    lookUp?: LookUp,
    shouldCache = true,
  ): null | T | T[] | AsyncHook<T> | (T | AsyncHook<T>)[] {
    const onSelf = () => {
      const registrations = this.dependencyCollection.get(id, quantity)!;

      let ret: (T | AsyncHook<T>)[] | T | AsyncHook<T> | null = null;
      if (Array.isArray(registrations)) {
        ret = registrations.map((dependencyItem) =>
          this._resolveDependency(id, dependencyItem, shouldCache),
        );
      } else {
        ret = this._resolveDependency(id, registrations, shouldCache);
      }

      return ret;
    };

    const onParent = () => {
      if (this.parent) {
        return this.parent.createDependency(
          id,
          quantity,
          undefined,
          shouldCache,
        );
      } else {
        if (quantity === Quantity.OPTIONAL) {
          return null;
        } else if (quantity === Quantity.MANY) {
          return [];
        }

        pushResolvingStack(id);
        throw new DependencyNotFoundError(id);
      }
    };

    if (lookUp === LookUp.SKIP_SELF) {
      return onParent();
    }

    if (this.dependencyCollection.has(id)) {
      return onSelf();
    }

    return onParent();
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
