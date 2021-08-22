import { DependencyIdentifier } from './dependencyIdentifier'
import { DependencyItem } from './dependencyItem'

let singletonFetchedLock = false

const singletonDependencies: [
    DependencyIdentifier<any>,
    DependencyItem<any>
][] = []

class DuplicatedRegistrationError extends Error {
    constructor(
        id: DependencyIdentifier<any>,
        item1: DependencyItem<any>,
        item2: DependencyItem<any>
    ) {
        super(`Duplicated registration of ${id}, 1. ${item1} 2. ${item2}`)
    }
}

export function registerSingleton<T>(
    id: DependencyIdentifier<T>,
    item: DependencyItem<T>
): void {
    const index = singletonDependencies.findIndex((r) => r[0] === id)

    if (index !== -1) {
        throw new DuplicatedRegistrationError(
            id,
            singletonDependencies[index][1],
            item
        )
    }

    singletonDependencies.push([id, item])
}

export function getSingletonDependencies(): [
    DependencyIdentifier<any>,
    DependencyItem<any>
][] {
    if (singletonFetchedLock) {
        console.warn(
            '[redi] Singleton dependencies has been fetched before by an other injector. ' +
                'Please avoid fetching singleton dependencies twice.'
        )
    }

    singletonFetchedLock = true

    return singletonDependencies
}

/* istanbul ignore next */
export function TEST_ONLY_clearSingletonDependencies(): void {
    singletonFetchedLock = false

    singletonDependencies.length = 0
}
