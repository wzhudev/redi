import * as React from 'react'
import { Injector } from '@wendellhu/redi'

export const RediContext = React.createContext<{ injector: Injector | null }>({
    injector: null,
})
RediContext.displayName = 'RediContext'

export const RediProvider = RediContext.Provider
export const RediConsumer = RediContext.Consumer
