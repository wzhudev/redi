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

function createDependencyRegistrationId(): string {
  const id = `registration-${nextDependencyRegistrationId}`;
  nextDependencyRegistrationId += 1;
  return id;
}

/** One distinct declarative registration, even when its item object is reused. */
export interface DependencyRegistration<T = any> {
  readonly id: string;
  readonly item: DependencyItem<T>;
}

/** One cached value associated with the registration that produced it. */
export interface ResolvedDependency<T = any> {
  readonly registrationId: string;
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

/**
 * Store unresolved dependencies in an injector.
 *
 * @internal
 */
export class DependencyCollection implements IDisposable {
  private readonly dependencyMap = new Map<
    DependencyIdentifier<any>,
    DependencyRegistration<any>[]
  >();

  constructor(dependencies: Dependency[]) {
    for (const pair of this.normalizeDependencies(dependencies)) {
      this.add(pair[0], pair[1]);
    }
  }

  public add<T>(ctor: Ctor<T>): DependencyRegistration<T>;
  public add<T>(
    id: DependencyIdentifier<T>,
    val: DependencyItem<T>,
  ): DependencyRegistration<T>;
  public add<T>(
    ctorOrId: Ctor<T> | DependencyIdentifier<T>,
    val?: DependencyItem<T>,
  ): DependencyRegistration<T> {
    if (typeof val === 'undefined') {
      val = { useClass: ctorOrId as Ctor<T>, lazy: false };
    }

    let arr = this.dependencyMap.get(ctorOrId);
    if (typeof arr === 'undefined') {
      arr = [];
      this.dependencyMap.set(ctorOrId, arr);
    }
    const registration: DependencyRegistration<T> = {
      id: createDependencyRegistrationId(),
      item: val,
    };
    arr.push(registration);
    return registration;
  }

  public delete<T>(id: DependencyIdentifier<T>): void {
    this.dependencyMap.delete(id);
  }

  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.REQUIRED,
  ): DependencyRegistration<T>;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.MANY,
  ): DependencyRegistration<T>[];
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity.OPTIONAL,
  ): DependencyRegistration<T> | null;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): DependencyRegistration<T> | DependencyRegistration<T>[] | null;
  public getRegistrations<T>(
    id: DependencyIdentifier<T>,
    quantity: Quantity,
  ): DependencyRegistration<T> | DependencyRegistration<T>[] | null {
    const ret = this.dependencyMap.get(id)!;

    checkQuantity(id, quantity, ret.length);
    return retrieveQuantity(quantity, ret);
  }

  public has<T>(id: DependencyIdentifier<T>): boolean {
    return this.dependencyMap.has(id);
  }

  /** Read-only copy used by Injector tooling without exposing mutable storage. */
  public snapshot(): readonly (readonly [
    DependencyIdentifier<any>,
    readonly DependencyRegistration<any>[],
  ])[] {
    const snapshot: Array<
      readonly [
        DependencyIdentifier<any>,
        readonly DependencyRegistration<any>[],
      ]
    > = [];
    for (const [identifier, registrations] of this.dependencyMap) {
      snapshot.push([identifier, [...registrations]] as const);
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
export class ResolvedDependencyCollection implements IDisposable {
  private readonly resolvedDependencies = new Map<
    DependencyIdentifier<any>,
    ResolvedDependency<any>[]
  >();

  public constructor() {}

  public add<T>(
    id: DependencyIdentifier<T>,
    val: T | null,
    registrationId = createDependencyRegistrationId(),
  ): ResolvedDependency<T> {
    let arr = this.resolvedDependencies.get(id);
    if (typeof arr === 'undefined') {
      arr = [];
      this.resolvedDependencies.set(id, arr);
    }

    const resolved: ResolvedDependency<T> = {
      registrationId,
      value: val,
    };
    arr.push(resolved);
    return resolved;
  }

  public has<T>(id: DependencyIdentifier<T>): boolean {
    return this.resolvedDependencies.has(id);
  }

  public hasResolvedRegistration<T>(
    id: DependencyIdentifier<T>,
    registrationId: string,
  ): boolean {
    for (const entry of this.resolvedDependencies.get(id) ?? []) {
      if (entry.registrationId === registrationId) return true;
    }
    return false;
  }

  public getResolvedRegistration<T>(
    id: DependencyIdentifier<T>,
    registrationId: string,
  ): ResolvedDependency<T> | undefined {
    for (const entry of this.resolvedDependencies.get(id) ?? []) {
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
    for (const [identifier, entries] of this.resolvedDependencies) {
      snapshot.push([identifier, [...entries]] as const);
    }
    return snapshot;
  }

  /** Cached entries for an Identifier, copied to prevent mutation. */
  public entries<T>(
    id: DependencyIdentifier<T>,
  ): readonly ResolvedDependency<T>[] {
    return [...(this.resolvedDependencies.get(id) || [])];
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
    const entries = this.resolvedDependencies.get(id);

    if (!entries) {
      throw new DependencyNotFoundError(id);
    }

    checkQuantity(id, quantity, entries.length);
    const values: T[] = [];
    for (const entry of entries) {
      values.push(entry.value as T);
    }

    if (quantity === Quantity.MANY) {
      return values;
    } else {
      return values[0];
    }
  }

  public dispose(): void {
    for (const entries of this.resolvedDependencies.values()) {
      for (const { value } of entries) {
        if (isDisposable(value)) value.dispose();
      }
    }

    this.resolvedDependencies.clear();
  }
}
