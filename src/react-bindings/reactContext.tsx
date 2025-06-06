/* eslint-disable node/prefer-global/process */

import type { Injector } from '@wendellhu/redi';
import * as React from 'react';

const __REDI_CONTEXT_LOCK__ = 'REDI_CONTEXT_LOCK';
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

const globalObject: any =
  (typeof globalThis !== 'undefined' && globalThis) ||
  (typeof window !== 'undefined' && window) ||
  // eslint-disable-next-line no-restricted-globals
  (typeof global !== 'undefined' && global);

if (!globalObject[__REDI_CONTEXT_LOCK__]) {
  globalObject[__REDI_CONTEXT_LOCK__] = true;
} else if (!isNode) {
  console.error(
    '[redi]: "RediContext" is already created. You may import "RediContext" from different paths. Use "import { RediContext } from \'@wendellhu/redi/react-bindings\'; instead."',
  );
}

export interface IRediContext {
  injector: Injector | null;
}

export const RediContext = React.createContext<IRediContext>({
  injector: null,
});
RediContext.displayName = 'RediContext';

export const RediProvider = RediContext.Provider;
export const RediConsumer = RediContext.Consumer;
