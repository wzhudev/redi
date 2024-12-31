export { createIdentifier } from './decorators'
export { Dependency, DependencyPair } from './dependencyCollection'
export { setDependencies } from './dependencyDeclare'
export { forwardRef } from './dependencyForwardRef'
export {
  DependencyIdentifier,
  IdentifierDecorator,
} from './dependencyIdentifier'
export {
  AsyncDependencyItem,
  AsyncHook,
  ClassDependencyItem,
  Ctor,
  DependencyItem,
  FactoryDependencyItem,
  isAsyncDependencyItem,
  isAsyncHook,
  isClassDependencyItem,
  isCtor,
  isFactoryDependencyItem,
  isValueDependencyItem,
  SyncDependencyItem,
  ValueDependencyItem,
} from './dependencyItem'
export { Self, SkipSelf } from './dependencyLookUp'
export { Inject, Many, Optional } from './dependencyQuantity'
export { WithNew } from './dependencyWithNew'
export { IDisposable, isDisposable } from './dispose'
export { RediError } from './error'
export { IAccessor, Injector } from './injector'
export { LookUp, Quantity } from './types'

const globalObject: any
  = (typeof globalThis !== 'undefined' && globalThis)
  || (typeof window !== 'undefined' && window)
  // eslint-disable-next-line no-restricted-globals
  || (typeof global !== 'undefined' && global)

const __REDI_GLOBAL_LOCK__ = 'REDI_GLOBAL_LOCK'
// eslint-disable-next-line node/prefer-global/process
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null

if (globalObject[__REDI_GLOBAL_LOCK__]) {
  if (!isNode) {
    console.error(`[redi]: You are loading scripts of redi more than once! This may cause undesired behavior in your application.
Maybe your dependencies added redi as its dependency and bundled redi to its dist files. Or you import different versions of redi.
For more info please visit our website: https://redi.wendell.fun/en-US/docs/debug#import-scripts-of-redi-more-than-once`)
  }
}
else {
  globalObject[__REDI_GLOBAL_LOCK__] = true
}
