import { Ctor } from './dependencyItem'
import { ForwardRef } from './dependencyForwardRef'

export const IdentifierDecoratorSymbol = Symbol('$$IDENTIFIER_DECORATOR')

export type IdentifierDecorator<T> = {
    [IdentifierDecoratorSymbol]: true

    // call signature of an decorator
    (...args: any[]): void

    /**
     * beautify console
     */
    toString(): string

    type: T
}

export type DependencyIdentifier<T> = string | Ctor<T> | ForwardRef<T> | IdentifierDecorator<T>

export type NormalizedDependencyIdentifier<T> = Exclude<DependencyIdentifier<T>, ForwardRef<T>>
