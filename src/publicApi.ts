export { createIdentifier } from './decorators'
export { Quantity, LookUp } from './types'
export { Many, Optional, Inject } from './dependencyQuantity'
export { forwardRef } from './dependencyForwardRef'
export { Injector } from './injector'
export { SkipSelf, Self } from './dependencyLookUp'
export { DependencyPair, Dependency } from './dependencyCollection'
export { DependencyIdentifier, IdentifierDecorator } from './dependencyIdentifier'
export { Disposable } from './dispose'
export { setDependencies } from './dependencyDeclare'
export { WithNew } from './dependencyWithNew'
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
export { RediError } from './error'

const globalObject: any =
	(typeof globalThis !== 'undefined' && globalThis) ||
	(typeof window !== 'undefined' && window) ||
	// @ts-ignore
	(typeof global !== 'undefined' && global)

const __REDI_GLOBAL_LOCK__ = 'REDI_GLOBAL_LOCK'

if (globalObject[__REDI_GLOBAL_LOCK__]) {
	console.error('[redi]: Load scripts of redi more than once! This may cause undesired behavior in your application.')
} else {
	globalObject[__REDI_GLOBAL_LOCK__] = true
}
