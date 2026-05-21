import { acquireGlobalLock } from '../globalLock';

export { connectDependencies, connectInjector } from './reactComponent';
export { RediConsumer, RediContext, RediProvider } from './reactContext';
export { WithDependency } from './reactDecorators';
export { useDependency, useInjector } from './reactHooks';
export * from './reactRx';

acquireGlobalLock(
  'REDI_CONTEXT_LOCK',
  '[redi]: "RediContext" is already created. You may import "RediContext" from different paths. Use "import { RediContext } from \'@wendellhu/redi/react-bindings\'; instead."',
);
