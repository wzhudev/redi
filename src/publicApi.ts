import { acquireGlobalLock } from './globalLock';

export { createIdentifier } from './decorators';
export type { Dependency, DependencyPair } from './dependencyCollection';
export { setDependencies } from './dependencyDeclare';
export { forwardRef } from './dependencyForwardRef';
export {
  type DependencyIdentifier,
  type IdentifierDecorator,
} from './dependencyIdentifier';
export {
  type AsyncDependencyItem,
  type AsyncHook,
  type ClassDependencyItem,
  type Ctor,
  type DependencyItem,
  type FactoryDependencyItem,
  isAsyncDependencyItem,
  isAsyncHook,
  isClassDependencyItem,
  isCtor,
  isDependencyItem,
  isFactoryDependencyItem,
  isValueDependencyItem,
  type SyncDependencyItem,
  type ValueDependencyItem,
} from './dependencyItem';
export { Self, SkipSelf } from './dependencyLookUp';
export { Inject, Many, Optional } from './dependencyQuantity';
export { WithNew } from './dependencyWithNew';
export { type IDisposable, isDisposable } from './dispose';
export { RediError } from './error';
export { type IAccessor, Injector } from './injector';
export { InjectSelf } from './injectSelf';
export { LookUp, Quantity } from './types';

acquireGlobalLock(
  'REDI_GLOBAL_LOCK',
  `[redi]: You are loading scripts of redi more than once! This may cause undesired behavior in your application.
Maybe your dependencies added redi as its dependency and bundled redi to its dist files. Or you import different versions of redi.
For more info please visit our website: https://redi.wzhu.dev/en-US/docs/faq#import-scripts-of-redi-more-than-once`,
);
