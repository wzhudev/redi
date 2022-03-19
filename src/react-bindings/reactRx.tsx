import React, {
    useEffect,
    useState,
    createContext,
    useMemo,
    useContext,
    useCallback,
    ReactNode,
    Context,
    useRef,
} from 'react'
import { BehaviorSubject, Observable } from 'rxjs'

import { RediError } from '@wendellhu/redi';

/**
 * unwrap an observable value, return it to the component for rendering, and
 * trigger re-render when value changes
 *
 * **IMPORTANT**. Parent and child components should not subscribe to the same
 * observable, otherwise unnecessary re-render would be triggered. Instead, the
 * top-most component should subscribe and pass value of the observable to
 * its offspring, by props or context.
 *
 * If you have to do that, consider using `useDependencyContext` and
 * `useDependencyContextValue` instead.
 */
export function useDependencyValue<T>(depValue$: Observable<T>, defaultValue?: T): T | undefined {
    const firstValue: T | undefined =
        depValue$ instanceof BehaviorSubject && typeof defaultValue === 'undefined'
            ? depValue$.getValue()
            : defaultValue
    const [value, setValue] = useState(firstValue)

    useEffect(() => {
        const subscription = depValue$.subscribe((val: T) => setValue(val))
        return () => subscription.unsubscribe()
    }, [depValue$])

    return value
}

/**
 * subscribe to a signal that emits whenever data updates and re-render
 *
 * @param update$ a signal that the data the functional component depends has updated
 */
export function useUpdateBinder(update$: Observable<void>): void {
    const [, dumpSet] = useState(0)

    useEffect(() => {
        const subscription = update$.subscribe(() => dumpSet((prev) => prev + 1))
        return () => subscription.unsubscribe()
    }, [])
}

const DepValueMapProvider = new WeakMap<Observable<any>, Context<any>>()

/**
 * subscribe to an observable value from a service, creating a context for it so
 * it child component won't have to subscribe again and cause unnecessary
 */
export function useDependencyContext<T>(
    depValue$: Observable<T>,
    defaultValue?: T
): {
    Provider: (props: { initialState?: T; children: ReactNode }) => JSX.Element
    value: T | undefined
} {
    const depRef = useRef<Observable<T> | undefined>(undefined)
    const value = useDependencyValue(depValue$, defaultValue)
    const Context = useMemo(() => {
        return createContext<T | undefined>(value)
    }, [depValue$])
    const Provider = useCallback(
        (props: { initialState?: T; children: ReactNode }) => {
            return <Context.Provider value={value}>{props.children}</Context.Provider>
        },
        [depValue$, value]
    )

    if (depRef.current !== depValue$) {
        if (depRef.current) {
            DepValueMapProvider.delete(depRef.current)
        }

        depRef.current = depValue$
        DepValueMapProvider.set(depValue$, Context)
    }

    return {
        Provider,
        value,
    }
}

export function useDependencyContextValue<T>(depValue$: Observable<T>): T | undefined {
    const context = DepValueMapProvider.get(depValue$)

    if (!context) {
        throw new RediError(`try to read context value but no ancestor component subscribed it.`)
    }

    return useContext(context)
}
