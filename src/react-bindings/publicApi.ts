/* eslint-disable node/prefer-global/process */

export { connectDependencies, connectInjector } from './reactComponent';
export { RediConsumer, RediContext, RediProvider } from './reactContext';
export { WithDependency } from './reactDecorators';
export { useDependency, useInjector } from './reactHooks';
export * from './reactRx';
export * from './reactRxNeo';

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
