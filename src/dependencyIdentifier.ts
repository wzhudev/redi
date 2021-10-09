import { Ctor } from './dependencyItem'
import { ForwardRef } from './dependencyForwardRef'

export const IdentifierDecoratorSymbol = Symbol('$$IDENTIFIER_DECORATOR')

export type IdentifierDecorator<T> = {
    [IdentifierDecoratorSymbol]: true

    /**
     * decorator
     */
    (target: Ctor<T>, key: string, index: number): void

    /**
     * beautify console
     */
    toString(): string
}

export type DependencyIdentifier<T> = string | Ctor<T> | ForwardRef<T> | IdentifierDecorator<T>

export type NormalizedDependencyIdentifier<T> = Exclude<DependencyIdentifier<T>, ForwardRef<T>>
