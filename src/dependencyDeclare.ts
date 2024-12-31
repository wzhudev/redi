import type { Ctor, FactoryDep } from './dependencyItem'
import { setDependency } from './decorators'
import { normalizeFactoryDeps } from './dependencyDescriptor'

/**
 * Register dependencies on a class.
 *
 * @param registerTarget The target constructor
 * @param deps Dependencies
 * @param startIndex The start index of the dependencies. Default is 0. When you want to set dependencies on a class
 * that has custom parameters, you should set `startIndex` to the count of these custom parameters.
 */
export function setDependencies<U>(
  registerTarget: Ctor<U>,
  deps: FactoryDep<any>[],
  startIndex = 0,
): void {
  const normalizedDescriptors = normalizeFactoryDeps(deps, startIndex)
  normalizedDescriptors.forEach((descriptor) => {
    setDependency(
      registerTarget,
      descriptor.identifier,
      descriptor.paramIndex,
      descriptor.quantity,
      descriptor.lookUp,
    )
  })
}
