import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Ctor, DependencyItem } from './dependencyItem';
import type { IDisposable } from './dispose';
import { isIdentifierDecorator } from './dependencyIdentifier';
import { prettyPrintIdentifier } from './dependencyItem';
import { checkQuantity, retrieveQuantity } from './dependencyQuantity';
import { isDisposable } from './dispose';
import { RediError } from './error';
import { Quantity } from './types';

/**
 * A tuple representing a dependency registration with an identifier and configuration.
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * const pair: DependencyPair<ILogger> = [ILogger, { useClass: ConsoleLogger }];
 * ```
 */
export type DependencyPair<T> = [DependencyIdentifier<T>, DependencyItem<T>];

/**
 * A tuple representing a class registered as its own identifier.
 *
 * @template T - The type of the class instance.
 */
export type DependencyClass<T> = [Ctor<T>];

/**
 * A dependency registration that can be passed to an Injector.
 *
 * Can be either:
 * - `[ClassName]` - A class registered as its own identifier
 * - `[Identifier, DependencyItem]` - An identifier with its configuration
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * const injector = new Injector([
 *   [MyService],                                    // DependencyClass
 *   [ILogger, { useClass: ConsoleLogger }],        // DependencyPair
 *   ['API_URL', { useValue: 'https://...' }],      // DependencyPair with string
 * ]);
 * ```
 */
export type Dependency<T = any> = DependencyPair<T> | DependencyClass<T>;

export type DependencyWithInstance<T = any> = [
  Ctor<T> | DependencyIdentifier<T>,
  T,
];
export type DependencyOrInstance<T = any> =
  | Dependency<T>
  | DependencyWithInstance<T>;

export function isBareClassDependency<T>(
  thing: Dependency<T>,
): thing is DependencyClass<T> {
  return thing.length === 1;
}

let nextDependencyRegistrationId = 1;

/**
 * Globally unique identity for a registration (declared or synthetic). Kept
 * numeric so assigning it is cheap and does not allocate a string.
 */
function createDependencyRegistrationId(): number {
  return nextDependencyRegistrationId++;
}

/** One cached value associated with the registration that produced it. */
export interface ResolvedDependency<T = any> {
  readonly registrationId: number;
  readonly value: T | null;
}

const ResolvingStack: DependencyIdentifier<any>[] = [];

export function pushResolvingStack(id: DependencyIdentifier<unknown>) {
  ResolvingStack.push(id);
}

export function popupResolvingStack() {
  ResolvingStack.pop();
}

export function clearResolvingStack() {
  ResolvingStack.length = 0;
}

export class DependencyNotFoundForModuleError extends RediError {
  constructor(
    toInstantiate: Ctor<any> | DependencyIdentifier<any>,
    id: DependencyIdentifier<any>,
    index: number,
  ) {
    const msg = `Cannot find "${prettyPrintIdentifier(id)}" registered by any injector. It is the ${index}th param of "${
      isIdentifierDecorator(toInstantiate)
        ? prettyPrintIdentifier(toInstantiate)
        : (toInstantiate as Ctor<any>).name
    }".`;

    super(msg);
  }
}

export class DependencyNotFoundError extends RediError {
  constructor(id: DependencyIdentifier<any>) {
    const stack: string[] = [];
    for (const resolvingId of ResolvingStack) {
      stack.push(prettyPrintIdentifier(resolvingId));
    }
    const msg = `Cannot find "${prettyPrintIdentifier(id)}" registered by any injector. The stack of dependencies is: "${stack.join(' -> ')}".`;

    super(msg);

    clearResolvingStack();
  }
}

interface DependencyBucket<T> {
  items: DependencyItem<T>[];
  /** Parallel array of globally unique registration ids. */
  ids: number[];
}

const EMPTY_REGISTRATION_IDS: readonly number[] = [];

/**
 * Store unresolved dependencies in an injector.
 *
 * @internal
 */
export class DependencyCollection implements IDisposable {
  private readonly dependencyMap = new Map<
    DependencyIdentifier<any>,
    DependencyBucket<any>
  >();

  constructor(dependencies: Dependency[]) {
    for (const pair of this.normalizeDependencies(dependencies)) {
      this.add(pair[0], pair[1]);
    }
  }

  public add<T>(ctor: Ctor<T>): void;
  public add<T>(id: DependencyIdentifier<T>, val: DependencyItem<T>): void;
  public add<T>(
    ctorOrId: Ctor<T> | DependencyIdentifier<T>,
    val?: DependencyItem<T>,
  ): void {
    if (typeof val === 'undefined') {
      val = { useClass: ctorOrId as Ctor<T>, lazy: false };
    }

    let bucket = this.dependencyMap.get(ctorOrId);
    if (typeof bucket === 'undefined') {
      bucket = { ids: [], items: [] };
      this.dependencyMap.set(ctorOrId, bucket);
    }
    // Identity lives in a parallel array so no per-registration wrapper object
    // is allocated in the hot construction path.
    bucket.items.push(val);
    bucket.ids.push(createDependencyRegistrationId());
  }

  public delete<T>(id: DependencyIdentifier<T>): void {
    this.dependencyMap.delete(id);
  }

  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.REQUIRED,
  ): DependencyItem<T>;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.MANY,
  ): DependencyItem<T>[];
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.OPTIONAL,
  ): DependencyItem<T> | null;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): DependencyItem<T> | DependencyItem<T>[] | null;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): DependencyItem<T> | DependencyItem<T>[] | null {
    const bucket = this.dependencyMap.get(id)!;

    checkQuantity(id, quantity, bucket.items.length);
    return retrieveQuantity(quantity, bucket.items);
  }

  /**
   * Globally unique ids for an Identifier's registrations, in registration
   * order. The returned array is internal and must not be mutated.
   *
   * @internal
   */
  public getRegistrationIds<T>(id: DependencyIdentifier<T>): readonly number[] {
    return this.dependencyMap.get(id)?.ids ?? EMPTY_REGISTRATION_IDS;
  }

  public has<T>(id: DependencyIdentifier<T>): boolean {
    return this.dependencyMap.has(id);
  }

  /**
   * Direct, non-copying read of the registrations for an Identifier. Callers
   * must treat the returned array as read-only.
   *
   * @internal
   */
  public peek<T>(
    id: DependencyIdentifier<T>,
  ): readonly DependencyItem<T>[] | undefined {
    return this.dependencyMap.get(id)?.items;
  }

  /** Read-only copy used by Injector tooling without exposing mutable storage. */
  public snapshot(): readonly (readonly [
    DependencyIdentifier<any>,
    readonly DependencyItem<any>[],
  ])[] {
    const snapshot: Array<
      readonly [DependencyIdentifier<any>, readonly DependencyItem<any>[]]
    > = [];
    for (const [identifier, bucket] of this.dependencyMap) {
      snapshot.push([identifier, [...bucket.items]] as const);
    }
    return snapshot;
  }

  public dispose(): void {
    this.dependencyMap.clear();
  }

  /**
   * normalize dependencies to `DependencyItem`
   */
  private normalizeDependencies(
    dependencies: Dependency[],
  ): DependencyPair<any>[] {
    const normalized: DependencyPair<any>[] = [];
    for (const dependency of dependencies) {
      const id = dependency[0];
      let val: DependencyItem<any>;
      if (isBareClassDependency(dependency)) {
        val = {
          useClass: dependency[0],
          lazy: false,
        };
      } else {
        val = dependency[1];
      }

      normalized.push([id, val]);
    }
    return normalized;
  }
}

/**
 * Store resolved dependencies.
 *
 * @internal
 */
interface ResolvedDependencyBucket<T> {
  entries: ResolvedDependency<T>[];
  values: T[];
}

export class ResolvedDependencyCollection implements IDisposable {
  private readonly resolvedDependencies = new Map<
    DependencyIdentifier<any>,
    ResolvedDependencyBucket<any>
  >();

  public constructor() {}

  public add<T>(
    id: DependencyIdentifier<T>,
    val: T | null,
    registrationId = createDependencyRegistrationId(),
  ): ResolvedDependency<T> {
    let bucket = this.resolvedDependencies.get(id);
    if (typeof bucket === 'undefined') {
      bucket = { entries: [], values: [] };
      this.resolvedDependencies.set(id, bucket);
    }

    const resolved: ResolvedDependency<T> = {
      registrationId,
      value: val,
    };
    bucket.entries.push(resolved);
    bucket.values.push(val as T);
    return resolved;
  }

  public has<T>(id: DependencyIdentifier<T>): boolean {
    return this.resolvedDependencies.has(id);
  }

  public hasResolvedRegistration<T>(
    id: DependencyIdentifier<T>,
    registrationId: number,
  ): boolean {
    for (const entry of this.resolvedDependencies.get(id)?.entries ?? []) {
      if (entry.registrationId === registrationId) return true;
    }
    return false;
  }

  public getResolvedRegistration<T>(
    id: DependencyIdentifier<T>,
    registrationId: number,
  ): ResolvedDependency<T> | undefined {
    for (const entry of this.resolvedDependencies.get(id)?.entries ?? []) {
      if (entry.registrationId === registrationId) return entry;
    }
    return undefined;
  }

  /** Read-only copy used to report creation state without resolving values. */
  public snapshot(): readonly (readonly [
    DependencyIdentifier<any>,
    readonly ResolvedDependency<any>[],
  ])[] {
    const snapshot: Array<
      readonly [DependencyIdentifier<any>, readonly ResolvedDependency<any>[]]
    > = [];
    for (const [identifier, bucket] of this.resolvedDependencies) {
      snapshot.push([identifier, [...bucket.entries]] as const);
    }
    return snapshot;
  }

  /** Cached entries for an Identifier, copied to prevent mutation. */
  public entries<T>(
    id: DependencyIdentifier<T>,
  ): readonly ResolvedDependency<T>[] {
    return [...(this.resolvedDependencies.get(id)?.entries ?? [])];
  }

  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.OPTIONAL,
  ): T | null;
  public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.REQUIRED): T;
  public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.MANY): T[];
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): T[] | T | null;
  public get<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): T | T[] | null {
    const bucket = this.resolvedDependencies.get(id);

    if (!bucket) {
      throw new DependencyNotFoundError(id);
    }

    checkQuantity(id, quantity, bucket.values.length);

    if (quantity === Quantity.MANY) {
      return bucket.values;
    }

    return bucket.values[0];
  }

  public dispose(): void {
    for (const bucket of this.resolvedDependencies.values()) {
      for (const { value } of bucket.entries) {
        if (isDisposable(value)) value.dispose();
      }
    }

    this.resolvedDependencies.clear();
  }
}
