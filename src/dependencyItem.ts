import { DependencyPair } from './dependencyCollection'
import { DependencyIdentifier } from './dependencyIdentifier'
import { Self, SkipSelf } from './dependencyLookUp'
import { Many, Optional } from './dependencyQuantity'

export interface Ctor<T> {
    new (...args: any[]): T

    name: string // constructor function has a name
}
export function isCtor<T>(thing: any): thing is Ctor<T> {
    return typeof thing === 'function'
}

export interface ClassDependencyItem<T> {
    useClass: Ctor<T>
    lazy?: boolean
}
export function isClassDependencyItem<T>(
    thing: any
): thing is ClassDependencyItem<T> {
    if (thing && typeof (thing as any).useClass !== 'undefined') {
        return true
    }

    return false
}

export type FactoryDepModifier =
    | typeof Self
    | typeof SkipSelf
    | typeof Optional
    | typeof Many

export type FactoryDep<T> =
    | [...FactoryDepModifier[], DependencyIdentifier<T>]
    | DependencyIdentifier<T>

export interface FactoryDependencyItem<T> {
    useFactory: (...deps: any[]) => T
    deps?: FactoryDep<any>[]
}
export function isFactoryDependencyItem<T>(
    thing: any
): thing is FactoryDependencyItem<T> {
    if (thing && typeof (thing as any).useFactory !== 'undefined') {
        return true
    }

    return false
}

export interface ValueDependencyItem<T> {
    useValue: T
}
export function isInstanceDependencyItem<T>(
    thing: any
): thing is ValueDependencyItem<T> {
    if (thing && typeof (thing as any).useValue !== 'undefined') {
        return true
    }

    return false
}

export interface AsyncDependencyItem<T> {
    useAsync: () => Promise<
        T | Ctor<T> | [DependencyIdentifier<T>, SyncDependencyItem<T>]
    >
}
export function isAsyncDependencyItem<T>(
    thing: any
): thing is AsyncDependencyItem<T> {
    if (thing && typeof (thing as any).useAsync !== 'undefined') {
        return true
    }

    return false
}

export interface AsyncHook<T> {
    whenReady(): Promise<T>
}
export function isAsyncHook<T>(thing: any): thing is AsyncHook<T> {
    if (thing && typeof (thing as any).whenReady !== 'undefined') {
        return true
    }

    return false
}

export type SyncDependencyItem<T> =
    | ClassDependencyItem<T>
    | FactoryDependencyItem<T>
    | ValueDependencyItem<T>

export type DependencyItem<T> = SyncDependencyItem<T> | AsyncDependencyItem<T>
