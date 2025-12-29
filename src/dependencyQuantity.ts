import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Ctor } from './dependencyItem';
import {
  getDependencyByIndex,
  RequiredDecoratorMisusedError,
  setDependency,
} from './decorators';
import { prettyPrintIdentifier } from './dependencyItem';
import { RediError } from './error';
import { Quantity } from './types';

function mapQuantityToNumber(
  quantity: Quantity.OPTIONAL | Quantity.REQUIRED,
): string {
  if (quantity === Quantity.OPTIONAL) {
    return '0 or 1';
  } else {
    return '1';
  }
}

export class QuantityCheckError extends RediError {
  constructor(
    id: DependencyIdentifier<any>,
    public readonly quantity: Quantity.OPTIONAL | Quantity.REQUIRED,
    public readonly actual: number,
  ) {
    let msg = `Expect ${mapQuantityToNumber(quantity)} dependency item(s) for id "${prettyPrintIdentifier(
      id,
    )}" but get ${actual}.`;

    if (actual === 0) {
      msg += ' Did you forget to register it?';
    }

    if (actual > 1) {
      msg += ' You register it more than once.';
    }

    super(msg);
  }
}

export function checkQuantity(
  id: DependencyIdentifier<any>,
  quantity: Quantity,
  length: number,
): void {
  if (
    (quantity === Quantity.OPTIONAL && length > 1) ||
    (quantity === Quantity.REQUIRED && length !== 1)
  ) {
    throw new QuantityCheckError(id, quantity, length);
  }
}

export function retrieveQuantity<T>(quantity: Quantity, arr: T[]): T[] | T {
  if (quantity === Quantity.MANY) {
    return arr;
  } else {
    return arr[0];
  }
}

function changeQuantity(target: Ctor<any>, index: number, quantity: Quantity) {
  const descriptor = getDependencyByIndex(target, index);
  descriptor.quantity = quantity;
}

function quantifyDecoratorFactoryProducer(quantity: Quantity) {
  return function decoratorFactory<T>(
    // typescript would remove `this` after transpilation
    // this line just declare the type of `this`
    this: any,
    id?: DependencyIdentifier<T>,
  ) {
    if (this instanceof decoratorFactory) {
      return this;
    }

    return function (registerTarget: Ctor<T>, _key: string, index: number) {
      if (id) {
        setDependency(registerTarget, id, index, quantity);
      } else {
        if (quantity === Quantity.REQUIRED) {
          throw new RequiredDecoratorMisusedError(registerTarget, index);
        }

        changeQuantity(registerTarget, index, quantity);
      }
    };
  } as any;
}

interface ManyDecorator {
  (id?: DependencyIdentifier<any>): any;
  new (): ManyDecorator;
}

/**
 * A parameter decorator that indicates the dependency should be resolved
 * as an array containing all registered instances of the dependency.
 *
 * Use this when multiple implementations are registered for the same identifier
 * and you want to receive all of them.
 *
 * @param id - Optional dependency identifier. If not provided, must be used
 *   after `@Inject()` decorator.
 *
 * @example
 * ```typescript
 * // Register multiple handlers
 * const injector = new Injector([
 *   [IHandler, { useClass: LoggingHandler }],
 *   [IHandler, { useClass: ValidationHandler }],
 *   [IHandler, { useClass: AuthHandler }],
 * ]);
 *
 * class EventProcessor {
 *   constructor(@Many(IHandler) private handlers: IHandler[]) {
 *     // handlers contains all three registered handlers
 *   }
 * }
 * ```
 */
export const Many: ManyDecorator = quantifyDecoratorFactoryProducer(
  Quantity.MANY,
);

interface OptionalDecorator {
  (id?: DependencyIdentifier<any>): any;
  new (): OptionalDecorator;
}

/**
 * A parameter decorator that marks a dependency as optional.
 *
 * If the dependency is not registered, `null` will be injected instead
 * of throwing an error.
 *
 * @param id - Optional dependency identifier. If not provided, must be used
 *   after `@Inject()` decorator.
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(
 *     @Optional(ICacheService) private cache: ICacheService | null
 *   ) {
 *     // cache will be null if ICacheService is not registered
 *   }
 * }
 *
 * // Or with @Inject
 * class MyService {
 *   constructor(
 *     @Optional() @Inject(ICacheService) private cache: ICacheService | null
 *   ) {}
 * }
 * ```
 */
export const Optional: OptionalDecorator = quantifyDecoratorFactoryProducer(
  Quantity.OPTIONAL,
);

interface InjectDecorator {
  (id: DependencyIdentifier<any>): any;
  new (): InjectDecorator;
}

/**
 * A parameter decorator that declares a required dependency to be injected.
 *
 * This is the primary way to declare dependencies when using decorators.
 * The dependency must be registered in the injector or its parent injectors,
 * otherwise an error will be thrown.
 *
 * @param id - The dependency identifier (class, string, or identifier created by `createIdentifier`).
 *
 * @example
 * ```typescript
 * class UserService {
 *   constructor(
 *     @Inject(AuthService) private auth: AuthService,
 *     @Inject(ILogger) private logger: ILogger
 *   ) {}
 * }
 *
 * // The dependency will be injected automatically
 * const injector = new Injector([[AuthService], [ILogger, { useClass: ConsoleLogger }]]);
 * const userService = injector.get(UserService);
 * ```
 */
export const Inject: InjectDecorator = quantifyDecoratorFactoryProducer(
  Quantity.REQUIRED,
);
