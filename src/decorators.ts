import type { DependencyDescriptor } from './dependencyDescriptor';
import type {
  DependencyIdentifier,
  IdentifierDecorator,
} from './dependencyIdentifier';
import type { Ctor } from './dependencyItem';
import type { LookUp } from './types';
import { normalizeForwardRef } from './dependencyForwardRef';
import { IdentifierDecoratorSymbol } from './dependencyIdentifier';
import { prettyPrintIdentifier } from './dependencyItem';
import { RediError } from './error';
import { Quantity } from './types';

export const TARGET = Symbol('$$TARGET');
export const DEPENDENCIES = Symbol('$$DEPENDENCIES');

class DependencyDescriptorNotFoundError extends RediError {
  constructor(index: number, target: Ctor<any>) {
    const msg = `Could not find dependency registered on the ${index} (indexed) parameter of the constructor of "${prettyPrintIdentifier(
      target,
    )}".`;

    super(msg);
  }
}

export class RequiredDecoratorMisusedError extends RediError {
  constructor(target: Ctor<any>, index: number) {
    const msg = `It seems that you forgot to provide a parameter to @Required() on the ${
      index
    }th parameter of "${prettyPrintIdentifier(target)}"`;

    super(msg);
  }
}

export class IdentifierUndefinedError extends RediError {
  constructor(target: Ctor<any>, index: number) {
    const msg = `It seems that you register "undefined" as dependency on the ${
      index
    }th parameter of "${prettyPrintIdentifier(
      target,
    )}". Please make sure that there is not cyclic dependency among your TypeScript files, or consider using "forwardRef". For more info please visit our website https://redi.wzhu.dev/docs/faq#could-not-find-dependency-registered-on`;

    super(msg);
  }
}

const EMPTY_DEPENDENCIES: DependencyDescriptor<any>[] = [];

/**
 * @internal
 */
export function getDependencies<T>(
  registerTarget: Ctor<T>,
): DependencyDescriptor<any>[] {
  const target = registerTarget as any;
  return target[DEPENDENCIES] || EMPTY_DEPENDENCIES;
}

/**
 * A cache of classes that have already had their dependency descriptors
 * sorted by `paramIndex` and had their `forwardRef`s unwrapped. Building this
 * per resolution is pure overhead in the cold path, so the result is cached
 * and invalidated whenever a class' descriptors are mutated.
 */
const sortedDependenciesCache = new WeakMap<
  Ctor<any>,
  DependencyDescriptor<any>[]
>();

/**
 * @internal
 */
export function getSortedDependencies<T>(
  registerTarget: Ctor<T>,
): DependencyDescriptor<any>[] {
  const cached = sortedDependenciesCache.get(registerTarget);
  if (cached) {
    return cached;
  }

  const dependencies = getDependencies(registerTarget);
  if (dependencies.length === 0) {
    sortedDependenciesCache.set(registerTarget, dependencies);
    return dependencies;
  }

  const sorted = dependencies
    .slice()
    .sort((a, b) => a.paramIndex - b.paramIndex);

  for (let index = 0; index < sorted.length; index += 1) {
    const descriptor = sorted[index];
    const identifier = normalizeForwardRef(descriptor.identifier);
    if (identifier !== descriptor.identifier) {
      sorted[index] = { ...descriptor, identifier };
    }
  }

  sortedDependenciesCache.set(registerTarget, sorted);
  return sorted;
}

/**
 * Drop the cached, sorted descriptors of a class. Must be called whenever a
 * class' dependency metadata is mutated.
 *
 * @internal
 */
export function invalidateDependencies<T>(registerTarget: Ctor<T>): void {
  sortedDependenciesCache.delete(registerTarget);
}

/**
 * @internal
 */
export function getDependencyByIndex<T>(
  registerTarget: Ctor<T>,
  index: number,
): DependencyDescriptor<any> {
  const allDependencies = getDependencies(registerTarget);
  const dep = allDependencies.find(
    (descriptor) => descriptor.paramIndex === index,
  );

  if (!dep) {
    throw new DependencyDescriptorNotFoundError(index, registerTarget);
  }

  return dep;
}

/**
 * @internal
 */
export function setDependency<T, U>(
  registerTarget: Ctor<U>,
  identifier: DependencyIdentifier<T>,
  paramIndex: number,
  quantity: Quantity = Quantity.REQUIRED,
  lookUp?: LookUp,
): void {
  const descriptor: DependencyDescriptor<T> = {
    paramIndex,
    identifier,
    quantity,
    lookUp,
    withNew: false,
  };

  // sometimes identifier could be 'undefined' if user meant to pass in an ES class
  // this is related to how classes are transpiled
  if (typeof identifier === 'undefined') {
    throw new IdentifierUndefinedError(registerTarget, paramIndex);
  }

  const target = registerTarget as any;
  // deal with inheritance, subclass need to declare dependencies on its on
  if (target[TARGET] === target) {
    target[DEPENDENCIES].push(descriptor);
  } else {
    target[DEPENDENCIES] = [descriptor];
    target[TARGET] = target;
  }

  invalidateDependencies(registerTarget);
}

const knownIdentifiers = new Set<string>();
const cachedIdentifiers = new Map<string, IdentifierDecorator<any>>();

/**
 * Create a dependency identifier for interface-based injection.
 *
 * Since TypeScript interfaces are erased at runtime, you cannot use them directly
 * as injection tokens. This function creates a unique identifier that can be used
 * to register and retrieve dependencies that implement an interface.
 *
 * The returned identifier can also be used as a decorator.
 *
 * @param id - A unique string name for the identifier. Should be unique across your application.
 * @returns An identifier that can be used both as a dependency token and as a parameter decorator.
 *
 * @example
 * ```typescript
 * interface ILogger {
 *   log(message: string): void;
 * }
 *
 * const ILogger = createIdentifier<ILogger>('ILogger');
 *
 * class ConsoleLogger implements ILogger {
 *   log(message: string) { console.log(message); }
 * }
 *
 * // Use as decorator
 * class MyService {
 *   constructor(@ILogger private logger: ILogger) {}
 * }
 *
 * // Register in injector
 * const injector = new Injector([[ILogger, { useClass: ConsoleLogger }]]);
 * ```
 */
export function createIdentifier<T>(id: string): IdentifierDecorator<T> {
  if (knownIdentifiers.has(id)) {
    console.error(
      `Identifier "${id}" already exists. Returning the cached identifier decorator.`,
    );
    return cachedIdentifiers.get(id)!;
  }

  const decorator = (<any>(
    function (registerTarget: Ctor<T>, _key: string, index: number): void {
      setDependency(registerTarget, decorator, index);
    }
  )) as IdentifierDecorator<T>;

  decorator.decoratorName = id;
  decorator.toString = () => decorator.decoratorName;
  decorator[IdentifierDecoratorSymbol] = true;

  knownIdentifiers.add(id);
  cachedIdentifiers.set(id, decorator);

  return decorator;
}

/**
 * @internal
 */
/* istanbul ignore next */
export function TEST_ONLY_clearKnownIdentifiers(): void {
  knownIdentifiers.clear();
  cachedIdentifiers.clear();
}
