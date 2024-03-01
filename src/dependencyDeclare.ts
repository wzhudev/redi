import { setDependency } from './decorators'
import { normalizeFactoryDeps } from './dependencyDescriptor'
import { Ctor, FactoryDep } from './dependencyItem'

/**
 * Register dependencies on a class.
 *
 * @param registerTarget The target constructor
 * @param deps Dependencies
 */
export function setDependencies<U>(
  registerTarget: Ctor<U>,
  deps: FactoryDep<any>[]
): void {
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
