import type { Injector } from '@wendellhu/redi';
import { createContext } from 'react';

export interface IRediContext {
  injector: Injector | null;
}

export const RediContext = createContext<IRediContext>({
  injector: null,
});
RediContext.displayName = 'RediContext';

export const RediProvider = RediContext.Provider;
export const RediConsumer = RediContext.Consumer;
