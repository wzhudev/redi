/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react'
import React from 'react'
import { createIdentifier, Injector } from 'redi'
import { WithDependency, connectInjector, connectDependencies, useInjector, RediContext } from 'redi/react'

import { TEST_ONLY_clearKnownIdentifiers } from '../src/decorators'
import { TEST_ONLY_clearSingletonDependencies } from '../src/dependencySingletons'

import { expectToThrow } from './util/expectToThrow'

describe('react', () => {
    afterEach(() => {
        TEST_ONLY_clearSingletonDependencies()
        TEST_ONLY_clearKnownIdentifiers()
    })

    it('should "connectInjector" work', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        const injector = new Injector([[aI, { useValue: { key: 'a' } }]])

        const App = connectInjector(function AppImpl() {
            const j = useInjector()
            const a = j.get(aI)

            return <div>{a.key}</div>
        }, injector)

        const { container } = render(<App />)
        expect(container.firstChild!.textContent).toBe('a')
    })

    it('should "connectDependencies" work', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        const App = connectDependencies(
            function AppImpl() {
                const j = useInjector()
                const a = j.get(aI)

                return <div>{a.key}</div>
            },
            [[aI, { useValue: { key: 'a' } }]]
        )

        const { container } = render(<App />)
        expect(container.firstChild!.textContent).toBe('a')
    })

    it('should with dependency work', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        const injector = new Injector([[aI, { useValue: { key: 'a' } }]])

        class AppImpl extends React.Component<{}> {
            static contextType = RediContext

            @WithDependency(aI)
            private readonly a!: A

            render() {
                return <div>{this.a.key}</div>
            }
        }

        const App = connectInjector(AppImpl, injector)

        const { container } = render(<App />)
        expect(container.firstChild!.textContent).toBe('a')
    })

    it('should throw error when using "useInjector" outside of "RediContext"', () => {
        function App() {
            const j = useInjector()

            return <div>a</div>
        }

        expectToThrow(() => render(<App />))
    })

    it('should throw error when using "WithDependency" outside of "RediContext"', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        const injector = new Injector([[aI, { useValue: { key: 'a' } }]])

        class AppImpl extends React.Component<{}> {
            @WithDependency(aI)
            private readonly a!: A

            render() {
                return <div>{this.a.key}</div>
            }
        }

        const App = connectInjector(AppImpl, injector)

        expectToThrow(() => render(<App />))
    })
})
