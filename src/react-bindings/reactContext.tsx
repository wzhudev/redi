import * as React from 'react'
import { Injector, RediError } from '@wendellhu/redi'

declare global {
	interface Window {
		RediContextCreated: string | null
	}
}

const RediContextCreated = '__RediContextCreated__'

if (!window.RediContextCreated) {
	window.RediContextCreated = RediContextCreated
} else {
	throw new RediError(
		'"RediContext" is already created. You may import "RediContext" from different paths. Use "import { RediContext } from \'@wendellhu/redi/react-bindings\'; instead."'
	)
}

export interface IRediContext {
	injector: Injector | null
}

export const RediContext = React.createContext<IRediContext>({
	injector: null,
})
RediContext.displayName = 'RediContext'

export const RediProvider = RediContext.Provider
export const RediConsumer = RediContext.Consumer
