import React, { ComponentType, PropsWithChildren, useRef } from 'react'
import { Dependency, Injector } from 'redi'

import { RediProvider, RediConsumer } from './reactContext'

function RediInjector(
    props: PropsWithChildren<{ dependencies: Dependency[] }>
) {
    const { children, dependencies } = props
    const childInjectorRef = useRef<Injector | null>(null)

    return (
        <RediConsumer>
            {(context: { injector: Injector | null }) => {
                let childInjector: Injector

                if (childInjectorRef.current) {
                    childInjector = childInjectorRef.current
                } else {
                    childInjector = context.injector
                        ? context.injector.createChild(dependencies)
                        : new Injector(dependencies)

                    childInjectorRef.current = childInjector
                }

                return (
                    <RediProvider value={{ injector: childInjector }}>
                        {children}
                    </RediProvider>
                )
            }}
        </RediConsumer>
    )
}

export function connectInjector<T>(
    Comp: ComponentType<T>,
    injector: Injector
): ComponentType<T> {
    return function ComponentWithInjector(props: T) {
        return (
            <RediProvider value={{ injector }}>
                <Comp {...props} />
            </RediProvider>
        )
    }
}

export function connectDependencies<T>(
    Comp: ComponentType<T>,
    dependencies: Dependency[]
): ComponentType<T> {
    return function ComponentWithInjector(props: T) {
        return (
            <RediInjector dependencies={dependencies}>
                <Comp {...props} />
            </RediInjector>
        )
    }
}
