import { DependencyIdentifier } from './dependencyIdentifier'
import { FactoryDep, FactoryDepModifier } from './dependencyItem'
import { Self, SkipSelf } from './dependencyLookUp'
import { Optional } from './dependencyQuantity'
import { LookUp, Quantity } from './types'

export interface DependencyDescriptor<T> {
    paramIndex: number
    identifier: DependencyIdentifier<T>
    quantity: Quantity
    lookUp?: LookUp
}

/**
 * describes dependencies of a IDependencyItem
 */
export interface Dependencies {
    dependencies: DependencyDescriptor<any>[]
}

export function normalizeFactoryDeps(deps?: FactoryDep<any>[]): DependencyDescriptor<any>[] {
    if (!deps) {
        return []
    }

    return deps.map((dep, index) => {
        if (!Array.isArray(dep)) {
            return {
                paramIndex: index,
                identifier: dep,
                quantity: Quantity.REQUIRED,
            }
        }

        const modifiers = dep.slice(0, dep.length - 1) as FactoryDepModifier[]
        const identifier = dep[dep.length - 1] as DependencyIdentifier<any>

        let lookUp: LookUp | undefined = undefined
        let quantity = Quantity.REQUIRED

        ;(modifiers as FactoryDepModifier[]).forEach((modifier: FactoryDepModifier) => {
            if (modifier instanceof Self) {
                lookUp = LookUp.SELF
            } else if (modifier instanceof SkipSelf) {
                lookUp = LookUp.SKIP_SELF
            } else if (modifier instanceof Optional) {
                quantity = Quantity.OPTIONAL
            } else {
                quantity = Quantity.MANY
            }
        })

        return {
            paramIndex: index,
            identifier: identifier as DependencyIdentifier<any>,
            quantity,
            lookUp,
        }
    })
}
