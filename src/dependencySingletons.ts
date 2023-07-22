import { RediError } from './error'
import { DependencyIdentifier } from './dependencyIdentifier'
import { DependencyItem, prettyPrintIdentifier } from './dependencyItem'

const singletonDependencies: [DependencyIdentifier<any>, DependencyItem<any>][] = []

class DuplicatedRegistrationError extends RediError {
    constructor(id: DependencyIdentifier<any>, item1: DependencyItem<any>, item2: DependencyItem<any>) {
        super(`Duplicated registration of ${prettyPrintIdentifier(id)}, 1. ${item1} 2. ${item2}.`)
    }
}

export function registerSingleton<T>(id: DependencyIdentifier<T>, item: DependencyItem<T>): void {
    const index = singletonDependencies.findIndex((r) => r[0] === id)

    if (index !== -1) {
        throw new DuplicatedRegistrationError(id, singletonDependencies[index][1], item)
    }

    singletonDependencies.push([id, item])
}

export function getSingletonDependencies(): [DependencyIdentifier<any>, DependencyItem<any>][] {
    return singletonDependencies
}

/* istanbul ignore next */
export function TEST_ONLY_clearSingletonDependencies(): void {
    singletonDependencies.length = 0
}

