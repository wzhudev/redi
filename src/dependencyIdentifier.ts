import type { ForwardRef } from './dependencyForwardRef';
import type { Ctor } from './dependencyItem';

export const IdentifierDecoratorSymbol = Symbol('$$IDENTIFIER_DECORATOR');

/**
 * An identifier decorator created by `createIdentifier`.
 *
 * This type represents a dependency identifier that can also be used as a
 * parameter decorator. It's typically used for interface-based dependency injection.
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * interface ILogger {
 *   log(message: string): void;
 * }
 *
 * // ILogger is of type IdentifierDecorator<ILogger>
 * const ILogger = createIdentifier<ILogger>('ILogger');
 *
 * class MyService {
 *   // Used as a decorator
 *   constructor(@ILogger private logger: ILogger) {}
 * }
 * ```
 */
export interface IdentifierDecorator<T> {
  [IdentifierDecoratorSymbol]: true;

  /** Call signature allowing use as a parameter decorator. */
  (...args: any[]): void;

  /** The name of this identifier, set when calling `createIdentifier`. */
  decoratorName: string;

  /** Returns the decorator name for debugging purposes. */
  toString: () => string;

  /** Phantom type property to preserve the type information. */
  type: T;
}

export function isIdentifierDecorator<T>(
  thing: any,
): thing is IdentifierDecorator<T> {
  return thing && thing[IdentifierDecoratorSymbol] === true;
}

/**
 * A type that represents all possible forms of dependency identifiers in redi.
 *
 * A dependency identifier can be:
 * - A **string**: Simple string token for value injection
 * - A **class constructor** (`Ctor<T>`): The class itself serves as its own identifier
 * - A **ForwardRef**: A wrapper for handling circular dependencies
 * - An **IdentifierDecorator**: Created by `createIdentifier` for interface-based injection
 *
 * @template T - The type of the dependency.
 *
 * @example
 * ```typescript
 * // Class as identifier
 * class MyService {}
 * injector.get(MyService);
 *
 * // String as identifier
 * injector.add(['API_URL', { useValue: 'https://api.example.com' }]);
 *
 * // IdentifierDecorator for interfaces
 * const ILogger = createIdentifier<ILogger>('ILogger');
 * injector.get(ILogger);
 * ```
 */
export type DependencyIdentifier<T> =
  | string
  | Ctor<T>
  | ForwardRef<T>
  | IdentifierDecorator<T>;

export type NormalizedDependencyIdentifier<T> = Exclude<
  DependencyIdentifier<T>,
  ForwardRef<T>
>;
