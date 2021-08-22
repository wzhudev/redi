import { createContext } from 'react'
import { Injector } from 'redi'

export const RediContext = createContext<{ injector: Injector | null }>({
    injector: null,
})
RediContext.displayName = 'RediContext'

export const RediProvider = RediContext.Provider
export const RediConsumer = RediContext.Consumer
