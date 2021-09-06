import { DependencyDescriptor } from './dependencyDescriptor'
import {
    DependencyIdentifier,
    IdentifierDecorator,
    IdentifierDecoratorSymbol,
} from './dependencyIdentifier'
import { Ctor } from './dependencyItem'
import { Quantity } from './dependencyQuantity'

export const TARGET = Symbol('$$TARGET')
export const DEPENDENCIES = Symbol('$$DEPENDENCIES')

class DependencyDescriptorNotFoundError extends Error {
    constructor(index: number, target: Ctor<any>) {
        const msg = `could not find dependency registered on the ${
            index + 1
        } parameter of the constructor of ${target}`

        super(msg)
    }
}

/**
 * get dependencies declared on a class
 *
 * @param registerTarget the class
 * @returns dependencies
 */
export function getDependencies<T>(
    registerTarget: Ctor<T>
): DependencyDescriptor<any>[] {
    const target = registerTarget as any
    return target[DEPENDENCIES] || []
}

export function getDependencyByIndex<T>(
    registerTarget: Ctor<T>,
    index: number
): DependencyDescriptor<any> {
    const allDependencies = getDependencies(registerTarget)
    const dep = allDependencies.find(
        (descriptor) => descriptor.paramIndex === index
    )

    if (!dep) {
        throw new DependencyDescriptorNotFoundError(index, registerTarget)
    }

    return dep
}

/**
 * declare dependency relationship on a class
 *
 * if the IDependencyDescriptor already exists, just modify it without creating
 * a new descriptor since differently decorators could be applied on a same
 * constructor property
 *
 * @param registerTarget the class to be registered
 * @param identifier dependency item identifier
 * @param paramIndex index of the decorator constructor parameter
 * @param quantity
 */
export function setDependency<T>(
    registerTarget: Ctor<T>,
    identifier: DependencyIdentifier<T>,
    paramIndex: number,
    quantity: Quantity = Quantity.REQUIRED
): void {
    const descriptor: DependencyDescriptor<T> = {
        paramIndex,
        identifier,
        quantity,
    }

    const target = registerTarget as any
    // deal with inheritance, subclass need to declare dependencies on its on
    if (target[TARGET] === target) {
        target[DEPENDENCIES].push(descriptor)
    } else {
        target[DEPENDENCIES] = [descriptor]
        target[TARGET] = target
    }
}

const knownIdentifiers = new Set<string>()
export function createIdentifier<T>(id: string): IdentifierDecorator<T> {
    if (knownIdentifiers.has(id)) {
        throw new Error(`identifier "${id}" already exists`)
    } else {
        knownIdentifiers.add(id)
    }

    const decorator = function (
        registerTarget: Ctor<T>,
        _key: string,
        index: number
    ): void {
        setDependency(registerTarget, decorator, index)
    } as IdentifierDecorator<T> // decorator as an identifier

    decorator.toString = () => id
    decorator[IdentifierDecoratorSymbol] = true

    return decorator
}

/* istanbul ignore next */
export function TEST_ONLY_clearKnownIdentifiers(): void {
    knownIdentifiers.clear()
}
