import { DependencyIdentifier } from './dependencyIdentifier'
import { Ctor, DependencyItem, prettyPrintIdentifier } from './dependencyItem'
import { checkQuantity, retrieveQuantity } from './dependencyQuantity'
import { Disposable, isDisposable } from './dispose'
import { Quantity } from './types'
import { RediError } from './error'

export type DependencyPair<T> = [DependencyIdentifier<T>, DependencyItem<T>]
export type DependencyClass<T> = [Ctor<T>]
export type Dependency<T = any> = DependencyPair<T> | DependencyClass<T>

export function isBareClassDependency<T>(thing: Dependency<T>): thing is DependencyClass<T> {
    return thing.length === 1
}

export class DependencyNotFoundError extends RediError {
    constructor(id: DependencyIdentifier<any>) {
        const msg = `Cannot find "${prettyPrintIdentifier(id)}" registered by any injector.`

        super(msg)
    }
}

/**
 * store unresolved dependencies in an injector
 *
 * @internal
 */
export class DependencyCollection implements Disposable {
    private readonly dependencyMap = new Map<DependencyIdentifier<any>, DependencyItem<any>[]>()

    constructor(private readonly dependencies: Dependency[]) {
        this.normalizeDependencies(dependencies).map((pair) => this.add(pair[0], pair[1]))
    }

    public add<T>(ctor: Ctor<T>): void
    public add<T>(id: DependencyIdentifier<T>, val: DependencyItem<T>): void
    public add<T>(ctorOrId: Ctor<T> | DependencyIdentifier<T>, val?: DependencyItem<T>): void {
        if (typeof val === 'undefined') {
            val = { useClass: ctorOrId as Ctor<T>, lazy: false }
        }

        let arr = this.dependencyMap.get(ctorOrId)
        if (typeof arr === 'undefined') {
            arr = []
            this.dependencyMap.set(ctorOrId, arr)
        }
        arr.push(val)
    }

    public delete<T>(id: DependencyIdentifier<T>): void {
        this.dependencyMap.delete(id)
    }

    public get<T>(id: DependencyIdentifier<T>): DependencyItem<T>
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.REQUIRED): DependencyItem<T>
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.MANY): DependencyItem<T>[]
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.OPTIONAL): DependencyItem<T> | null
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity): DependencyItem<T> | DependencyItem<T>[] | null
    public get<T>(
        id: DependencyIdentifier<T>,
        quantity: Quantity = Quantity.REQUIRED
    ): DependencyItem<T> | DependencyItem<T>[] | null {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ret = this.dependencyMap.get(id)!

        checkQuantity(id, quantity, ret.length)
        return retrieveQuantity(quantity, ret)
    }

    public has<T>(id: DependencyIdentifier<T>): boolean {
        return this.dependencyMap.has(id)
    }

    public append(dependencies: Dependency<any>[]): void {
        this.normalizeDependencies(dependencies).forEach((pair) => this.add(pair[0], pair[1]))
    }

    public dispose(): void {
        this.dependencyMap.clear()
    }

    /**
     * normalize dependencies to `DependencyItem`
     */
    private normalizeDependencies(dependencies: Dependency[]): DependencyPair<any>[] {
        return dependencies.map((dependency) => {
            const id = dependency[0]
            let val: DependencyItem<any>
            if (isBareClassDependency(dependency)) {
                val = {
                    useClass: dependency[0],
                    lazy: false,
                }
            } else {
                val = dependency[1]
            }

            return [id, val]
        })
    }
}

/**
 * store resolved dependencies
 *
 * @internal
 */
export class ResolvedDependencyCollection implements Disposable {
    private readonly resolvedDependencies = new Map<DependencyIdentifier<any>, any[]>()

    public add<T>(id: DependencyIdentifier<T>, val: T | null): void {
        let arr = this.resolvedDependencies.get(id)
        if (typeof arr === 'undefined') {
            arr = []
            this.resolvedDependencies.set(id, arr)
        }

        arr.push(val)
    }

    public has<T>(id: DependencyIdentifier<T>): boolean {
        return this.resolvedDependencies.has(id)
    }

    public delete<T>(id: DependencyIdentifier<T>): void {
        if (this.resolvedDependencies.has(id)) {
            const things = this.resolvedDependencies.get(id)!
            things.forEach((t) => (isDisposable(t) ? t.dispose() : void 0))
            this.resolvedDependencies.delete(id)
        }
    }

    public get<T>(id: DependencyIdentifier<T>): T
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.OPTIONAL): T | null
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.REQUIRED): T
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.MANY): T[]
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity): T[]
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity = Quantity.REQUIRED): T | T[] | null {
        const ret = this.resolvedDependencies.get(id)

        if (!ret) {
            throw new DependencyNotFoundError(id)
        }

        checkQuantity(id, quantity, ret.length)

        if (quantity === Quantity.MANY) {
            return ret
        } else {
            return ret[0]
        }
    }

    public dispose(): void {
        Array.from(this.resolvedDependencies.values()).forEach((items) => {
            items.forEach((item) => (isDisposable(item) ? item.dispose() : void 0))
        })

        this.resolvedDependencies.clear()
    }
}
