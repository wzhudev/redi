import { setDependency } from './decorators'
import { normalizeFactoryDeps } from './dependencyDescriptor'
import { Ctor, FactoryDep } from './dependencyItem'

export function setDependencies<U>(registerTarget: Ctor<U>, deps: FactoryDep<any>[]): void {
    const normalizedDescriptors = normalizeFactoryDeps(deps)
    normalizedDescriptors.forEach((descriptor) => {
        setDependency(
            registerTarget,
            descriptor.identifier,
            descriptor.paramIndex,
            descriptor.quantity,
            descriptor.lookUp
        )
    })
}
