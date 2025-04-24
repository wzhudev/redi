import type { ForwardRef } from './dependencyForwardRef'
import type { Ctor } from './dependencyItem'

export const IdentifierDecoratorSymbol = Symbol('$$IDENTIFIER_DECORATOR')

export interface IdentifierDecorator<T> {
  [IdentifierDecoratorSymbol]: true

  // call signature of an decorator
  (...args: any[]): void

  decoratorName: string

  toString: () => string

  type: T
}

export function isIdentifierDecorator<T>(
  thing: any,
): thing is IdentifierDecorator<T> {
  return thing && thing[IdentifierDecoratorSymbol] === true
}

export type DependencyIdentifier<T> =
  | string
  | Ctor<T>
  | ForwardRef<T>
  | IdentifierDecorator<T>

export type NormalizedDependencyIdentifier<T> = Exclude<
  DependencyIdentifier<T>,
  ForwardRef<T>
>
