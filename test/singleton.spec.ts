import { vi } from 'vitest'
import { createIdentifier, Injector, registerSingleton } from '@wendellhu/redi'

import { TEST_ONLY_clearKnownIdentifiers } from '../src/decorators'
import { getSingletonDependencies, TEST_ONLY_clearSingletonDependencies } from '../src/dependencySingletons'

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

		const dependencies = getSingletonDependencies();
        const j = new Injector(dependencies);

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
})
