import { vi } from 'vitest'
import { createIdentifier, Injector, registerSingleton } from '@wendellhu/redi'

import { TEST_ONLY_clearKnownIdentifiers } from '../src/decorators'
import { TEST_ONLY_clearSingletonDependencies } from '../src/dependencySingletons'

describe('singleton', () => {
    beforeAll(() => {
        TEST_ONLY_clearSingletonDependencies()
        TEST_ONLY_clearKnownIdentifiers()
    })

    afterEach(() => {
        TEST_ONLY_clearSingletonDependencies()
        TEST_ONLY_clearKnownIdentifiers()
    })

    it('should just works', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        registerSingleton(aI, { useValue: { key: 'a' } })

        const j = new Injector()

        expect(j.get(aI).key).toBe('a')
    })

    it('should throw error when register an identifier twice', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        registerSingleton(aI, { useValue: { key: 'a' } })

        expect(() => {
            registerSingleton(aI, { useValue: { key: 'a2' } })
        }).toThrowError()
    })

    it('should warn user when singleton is fetched more than once', () => {
        interface A {
            key: string
        }

        const aI = createIdentifier<A>('aI')

        registerSingleton(aI, { useValue: { key: 'a' } })

        const j = new Injector()

        expect(j.get(aI).key).toBe('a')

        const spy = vi.spyOn(console, 'warn')
        spy.mockImplementation(() => {})

        new Injector()

        expect(spy).toHaveBeenCalledWith(
            '[redi]: Singleton dependencies has been fetched before by an other injector. Please avoid fetching singleton dependencies twice.'
        )

        spy.mockRestore()
    })
})
