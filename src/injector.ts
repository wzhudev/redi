import { getDependencies } from './decorators'
import {
    Dependency,
    DependencyCollection,
    DependencyNotFoundError,
    ResolvedDependencyCollection,
    DependencyPair,
} from './dependencyCollection'
import { normalizeFactoryDeps } from './dependencyDescriptor'
import { DependencyIdentifier } from './dependencyIdentifier'
import {
    Ctor,
    DependencyItem,
    AsyncDependencyItem,
    isClassDependencyItem,
    isFactoryDependencyItem,
    isInstanceDependencyItem,
    isAsyncDependencyItem,
    ClassDependencyItem,
    FactoryDependencyItem,
    AsyncHook,
    isAsyncHook,
    isCtor,
    ValueDependencyItem,
    prettyPrintIdentifier,
} from './dependencyItem'
import { normalizeForwardRef } from './dependencyForwardRef'
import { IdleValue } from './idleValue'
import { getSingletonDependencies } from './dependencySingletons'
import { RediError } from './error'
import { Quantity, LookUp } from './types'

const MAX_RESOLUTIONS_QUEUED = 300

const NotInstantiatedSymbol = Symbol('$$NOT_INSTANTIATED_SYMBOL')

class CircularDependencyError<T> extends RediError {
    constructor(id: DependencyIdentifier<T>) {
        super(`Detecting cyclic dependency. The last identifier is "${prettyPrintIdentifier(id)}".`)
    }
}

class InjectorAlreadyDisposedError extends RediError {
    constructor() {
        super('Injector cannot be accessed after it disposes.')
    }
}

class AsyncItemReturnAsyncItemError<T> extends RediError {
    constructor(id: DependencyIdentifier<T>) {
        super(`Async item "${prettyPrintIdentifier(id)}" returns another async item.`)
    }
}

class GetAsyncItemFromSyncApiError<T> extends RediError {
    constructor(id: DependencyIdentifier<T>) {
        super(`Cannot get async item "${prettyPrintIdentifier(id)}" from sync api.`)
    }
}

export class Injector {
    private readonly dependencyCollection: DependencyCollection
    private readonly resolvedDependencyCollection = new ResolvedDependencyCollection()

    private readonly parent: Injector | null
    private readonly children: Injector[] = []

    private resolutionOngoing = 0

    private disposed = false

    constructor(collectionOrDependencies?: Dependency[], parent?: Injector) {
        this.dependencyCollection = new DependencyCollection(collectionOrDependencies || [])

        if (!parent) {
            this.parent = null
            this.dependencyCollection.append(getSingletonDependencies())
        } else {
            this.parent = parent
            parent.children.push(this)
        }

        this.resolvedDependencyCollection = new ResolvedDependencyCollection()
    }

    public createChild(dependencies?: Dependency[]): Injector {
        this.ensureInjectorNotDisposed()

        return new Injector(dependencies, this)
    }

    public dispose(): void {
        this.dependencyCollection.dispose()
        this.resolvedDependencyCollection.dispose()
        this.deleteThisFromParent();

        this.disposed = true
    }

    public add<T>(ctor: Ctor<T>): void
    public add<T>(pair: DependencyPair<T>): void
    public add<T>(id: DependencyIdentifier<T>, item: DependencyItem<T> | T): void
    public add<T>(
        dependency: Ctor<T> | DependencyPair<T> | DependencyIdentifier<T>,
        item?: DependencyItem<T> | T
    ): void {
        if (typeof item !== 'undefined' || Array.isArray(dependency)) {
            if (Array.isArray(dependency)) {
                item = dependency[1]
                dependency = dependency[0]
            }

            if (
                isAsyncDependencyItem(item) ||
                isClassDependencyItem(item) ||
                isInstanceDependencyItem(item) ||
                isFactoryDependencyItem(item)
            ) {
                this.dependencyCollection.add(dependency, item as DependencyItem<T>)
            } else {
                this.resolvedDependencyCollection.add(dependency, item as T)
            }
        } else {
            this.dependencyCollection.add(dependency as Ctor<T>)
        }
    }

    /**
     * get a dependency
     */
    public get<T>(id: DependencyIdentifier<T>, lookUp?: LookUp): T
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.MANY, lookUp?: LookUp): T[]
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.OPTIONAL, lookUp?: LookUp): T | null
    public get<T>(id: DependencyIdentifier<T>, quantity: Quantity.REQUIRED, lookUp?: LookUp): T
    public get<T>(id: DependencyIdentifier<T>, quantity?: Quantity, lookUp?: LookUp): T[] | T | null
    public get<T>(id: DependencyIdentifier<T>, quantityOrLookup?: Quantity | LookUp, lookUp?: LookUp): T[] | T | null
    public get<T>(id: DependencyIdentifier<T>, quantityOrLookup?: Quantity | LookUp, lookUp?: LookUp): T[] | T | null {
        const newResult = this._get(id, quantityOrLookup, lookUp)

        if ((Array.isArray(newResult) && newResult.some((r) => isAsyncHook(r))) || isAsyncHook(newResult)) {
            throw new GetAsyncItemFromSyncApiError(id)
        }

        return newResult as T | T[] | null
    }

    public _get<T>(
        id: DependencyIdentifier<T>,
        quantityOrLookup?: Quantity | LookUp,
        lookUp?: LookUp
    ): T[] | T | AsyncHook<T> | null {
        this.ensureInjectorNotDisposed()

        let quantity: Quantity = Quantity.REQUIRED
        if (
            quantityOrLookup === Quantity.REQUIRED ||
            quantityOrLookup === Quantity.OPTIONAL ||
            quantityOrLookup === Quantity.MANY
        ) {
            quantity = quantityOrLookup as Quantity
        } else {
            lookUp = quantityOrLookup as LookUp
        }

        // see if the dependency is already resolved, return it and check quantity
        const cachedResult = this.getValue(id, quantity, lookUp)
        if (cachedResult !== NotInstantiatedSymbol) {
            return cachedResult
        }

        // see if the dependency can be instantiated by itself or its parent
        return this.createAndCacheDependency(id, quantity, lookUp) as T[] | T | AsyncHook<T> | null
    }

    /**
     * get a dependency, but in async way
     */
    public getAsync<T>(id: DependencyIdentifier<T>): Promise<T> {
        this.ensureInjectorNotDisposed()

        const cachedResult = this.getValue(id, Quantity.REQUIRED)
        if (cachedResult !== NotInstantiatedSymbol) {
            return Promise.resolve(cachedResult as T)
        }

        const newResult = this.createAndCacheDependency(id, Quantity.REQUIRED)
        if (!isAsyncHook(newResult)) {
            return Promise.resolve(newResult as T)
        }

        return newResult.whenReady()
    }

    /**
     * to instantiate a class withing the current injector
     */
    public createInstance<T extends unknown[], U extends unknown[], C>(
        ctor: new (...args: [...T, ...U]) => C,
        ...customArgs: T
    ): C {
        this.ensureInjectorNotDisposed()

        return this.resolveClass_(ctor as Ctor<C>, ...customArgs)
    }

    /**
     * resolve different types of dependencies
     */
    private resolveDependency<T>(id: DependencyIdentifier<T>, item: DependencyItem<T>): T | AsyncHook<T> {
        if (isInstanceDependencyItem(item)) {
            return this.resolveInstanceDependency(id, item)
        } else if (isFactoryDependencyItem(item)) {
            return this.resolveFactory(id, item)
        } else if (isClassDependencyItem(item)) {
            return this.resolveClass(id, item)
        } else {
            return this.resolveAsync(id, item)
        }
    }

    private resolveInstanceDependency<T>(id: DependencyIdentifier<T>, item: ValueDependencyItem<T>): T {
        const thing = item.useValue
        this.resolvedDependencyCollection.add(id, thing)
        return thing
    }

    private resolveClass<T>(id: DependencyIdentifier<T> | null, item: ClassDependencyItem<T>): T {
        const ctor = item.useClass
        let thing: T

        if (item.lazy) {
            const idle = new IdleValue<T>(() => this.resolveClass_(ctor))
            thing = new Proxy(Object.create(null), {
                get(target: any, key: string | number | symbol): any {
                    if (key in target) {
                        return target[key] // such as toString
                    }

                    // hack checking if it's a async loader
                    if (key === 'whenReady') {
                        return undefined
                    }

                    const val = idle.getValue()

                    let prop = (val as any)[key]
                    if (typeof prop !== 'function') {
                        return prop
                    }

                    prop = prop.bind(val)
                    target[key] = prop
                    return prop
                },
                set(_target: any, key: string | number | symbol, value: any): boolean {
                    ;(idle.getValue() as any)[key] = value
                    return true
                },
            })
        } else {
            thing = this.resolveClass_(ctor)
        }

        if (id) {
            this.resolvedDependencyCollection.add(id, thing)
        }

        return thing
    }

    private resolveClass_<T>(ctor: Ctor<T>, ...extraParams: any[]) {
        this.markNewResolution(ctor)

        const declaredDependencies = getDependencies(ctor)
            .sort((a, b) => a.paramIndex - b.paramIndex)
            .map((descriptor) => ({
                ...descriptor,
                identifier: normalizeForwardRef(descriptor.identifier),
            }))

        const resolvedArgs: any[] = []

        for (const dep of declaredDependencies) {
            const thing = this._get(dep.identifier, dep.quantity, dep.lookUp) // recursive happens here
            resolvedArgs.push(thing)
        }

        let args = [...extraParams]
        const firstDependencyArgIndex =
            declaredDependencies.length > 0 ? declaredDependencies[0].paramIndex : args.length

        if (args.length !== firstDependencyArgIndex) {
            console.warn(`[redi]: Expect ${firstDependencyArgIndex} custom parameter(s) but get ${args.length}.`)

            const delta = firstDependencyArgIndex - args.length
            if (delta > 0) {
                args = [...args, ...new Array(delta).fill(undefined)]
            } else {
                args = args.slice(0, firstDependencyArgIndex)
            }
        }

        const thing = new ctor(...args, ...resolvedArgs)

        this.markResolutionCompleted()

        return thing
    }

    private resolveFactory<T>(id: DependencyIdentifier<T>, item: FactoryDependencyItem<T>): T {
        this.markNewResolution(id)

        const declaredDependencies = normalizeFactoryDeps(item.deps)

        const resolvedArgs: any[] = []
        for (const dep of declaredDependencies) {
            const thing = this.get(dep.identifier, dep.quantity, dep.lookUp)
            resolvedArgs.push(thing)
        }

        const thing = item.useFactory.apply(null, resolvedArgs)

        this.resolvedDependencyCollection.add(id, thing)
        this.markResolutionCompleted()

        return thing
    }

    private resolveAsync<T>(id: DependencyIdentifier<T>, item: AsyncDependencyItem<T>): AsyncHook<T> {
        const asyncLoader: AsyncHook<T> = {
            whenReady: () => this.resolveAsync_(id, item),
        }
        return asyncLoader
    }

    private resolveAsync_<T>(id: DependencyIdentifier<T>, item: AsyncDependencyItem<T>): Promise<T> {
        return item.useAsync().then((thing) => {
            // check if another promise has been resolved,
            // do not resolve the async item twice
            const resolvedCheck = this.getValue(id)
            if (resolvedCheck !== NotInstantiatedSymbol) {
                return resolvedCheck as T
            }

            let ret: T
            if (Array.isArray(thing)) {
                const item = thing[1]
                if (isAsyncDependencyItem(item)) {
                    throw new AsyncItemReturnAsyncItemError(id)
                } else {
                    ret = this.resolveDependency(id, item) as T
                }
            } else if (isCtor(thing)) {
                ret = this.resolveClass_(thing)
            } else {
                ret = thing
            }

            this.resolvedDependencyCollection.add(id, ret)

            return ret
        })
    }

    /**
     * recursively get a dependency value
     */
    private getValue<T>(
        id: DependencyIdentifier<T>,
        quantity: Quantity = Quantity.REQUIRED,
        lookUp?: LookUp
    ): null | T | T[] | typeof NotInstantiatedSymbol {
        const onSelf = () => {
            if (this.dependencyCollection.has(id) && !this.resolvedDependencyCollection.has(id)) {
                return NotInstantiatedSymbol
            }

            return this.resolvedDependencyCollection.get(id, quantity)
        }

        const onParent = () => {
            if (this.parent) {
                return this.parent.getValue(id, quantity)
            } else {
                return NotInstantiatedSymbol
            }
        }

        if (lookUp === LookUp.SKIP_SELF) {
            return onParent()
        }

        if (lookUp === LookUp.SELF) {
            return onSelf()
        }

        if (this.resolvedDependencyCollection.has(id) || this.dependencyCollection.has(id)) {
            return onSelf()
        }

        return onParent()
    }

    /**
     * create instance on the correct injector
     */
    private createAndCacheDependency<T>(
        id: DependencyIdentifier<T>,
        quantity: Quantity = Quantity.REQUIRED,
        lookUp?: LookUp
    ): null | T | T[] | AsyncHook<T> | (T | AsyncHook<T>)[] {
        const onSelf = () => {
            const registrations = this.dependencyCollection.get(id, quantity)

            let ret: (T | AsyncHook<T>)[] | T | AsyncHook<T> | null = null
            if (Array.isArray(registrations)) {
                ret = registrations.map((dependencyItem) => this.resolveDependency(id, dependencyItem))
            } else if (registrations) {
                ret = this.resolveDependency(id, registrations)
            }

            return ret
        }

        const onParent = () => {
            if (this.parent) {
                return this.parent.createAndCacheDependency(id, quantity)
            } else {
                if (quantity === Quantity.OPTIONAL) {
                    return null
                }

                throw new DependencyNotFoundError(id)
            }
        }

        if (lookUp === LookUp.SKIP_SELF) {
            return onParent()
        }

        if ((id as any as Ctor<Injector>) === Injector) {
            return this as any as T
        }

        if (this.dependencyCollection.has(id)) {
            return onSelf()
        }

        return onParent()
    }

    private markNewResolution<T>(id: DependencyIdentifier<T>): void {
        this.resolutionOngoing += 1

        if (this.resolutionOngoing >= MAX_RESOLUTIONS_QUEUED) {
            throw new CircularDependencyError(id)
        }
    }

    private markResolutionCompleted(): void {
        this.resolutionOngoing -= 1
    }

    private ensureInjectorNotDisposed(): void {
        if (this.disposed) {
            throw new InjectorAlreadyDisposedError()
        }
    }

    private deleteThisFromParent(): void {
        if (this.parent) {
            const index = this.parent.children.indexOf(this)
            this.parent.children.splice(index, 1);
        }
    }
}
