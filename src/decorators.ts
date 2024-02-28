import { DependencyDescriptor } from './dependencyDescriptor'
import {
	DependencyIdentifier,
	IdentifierDecorator,
	IdentifierDecoratorSymbol,
} from './dependencyIdentifier'
import { Ctor, prettyPrintIdentifier } from './dependencyItem'
import { LookUp, Quantity } from './types'
import { RediError } from './error'

export const TARGET = Symbol('$$TARGET')
export const DEPENDENCIES = Symbol('$$DEPENDENCIES')

class DependencyDescriptorNotFoundError extends RediError {
	constructor(index: number, target: Ctor<any>) {
		const msg = `Could not find dependency registered on the ${index} (indexed) parameter of the constructor of "${prettyPrintIdentifier(
			target
		)}".`

		super(msg)
	}
}

export class IdentifierUndefinedError extends RediError {
	constructor(target: Ctor<any>, index: number) {
		const msg = `It seems that you register "undefined" as dependency on the ${
			index + 1
		} parameter of "${prettyPrintIdentifier(
			target
		)}". Please make sure that there is not cyclic dependency among your TypeScript files, or consider using "forwardRef". For more info please visit our website https://redi.wendell.fun/docs/debug#could-not-find-dependency-registered-on`

		super(msg)
	}
}

/**
 * @internal
 */
export function getDependencies<T>(
	registerTarget: Ctor<T>
): DependencyDescriptor<any>[] {
	const target = registerTarget as any
	return target[DEPENDENCIES] || []
}

/**
 * @internal
 */
export function getDependencyByIndex<T>(
	registerTarget: Ctor<T>,
	index: number
): DependencyDescriptor<any> {
	const allDependencies = getDependencies(registerTarget)
	const dep = allDependencies.find(
		(descriptor) => descriptor.paramIndex === index
	)

	if (!dep) {
		throw new DependencyDescriptorNotFoundError(index, registerTarget)
	}

	return dep
}

/**
 * @internal
 */
export function setDependency<T, U>(
	registerTarget: Ctor<U>,
	identifier: DependencyIdentifier<T>,
	paramIndex: number,
	quantity: Quantity = Quantity.REQUIRED,
	lookUp?: LookUp
): void {
	const descriptor: DependencyDescriptor<T> = {
		paramIndex,
		identifier,
		quantity,
		lookUp,
		withNew: false,
	}

	// sometimes identifier could be 'undefined' if user meant to pass in an ES class
	// this is related to how classes are transpiled
	if (typeof identifier === 'undefined') {
		throw new IdentifierUndefinedError(registerTarget, paramIndex)
	}

	const target = registerTarget as any
	// deal with inheritance, subclass need to declare dependencies on its on
	if (target[TARGET] === target) {
		target[DEPENDENCIES].push(descriptor)
	} else {
		target[DEPENDENCIES] = [descriptor]
		target[TARGET] = target
	}
}

const knownIdentifiers = new Set<string>()

/**
 * Create a dependency identifier
 *
 * @param id name of the identifier
 * @returns Identifier that could also be used as a decorator
 */
export function createIdentifier<T>(id: string): IdentifierDecorator<T> {
	if (knownIdentifiers.has(id)) {
		throw new RediError(`Identifier "${id}" already exists.`)
	} else {
		knownIdentifiers.add(id)
	}

	const decorator = (<any>(
		function (registerTarget: Ctor<T>, _key: string, index: number): void {
			setDependency(registerTarget, decorator, index)
		}
	)) as IdentifierDecorator<T> // decorator as an identifier

	// TODO: @wzhudev should assign a name to the function so it would be easy to debug in inspect tools
	// decorator.name = `[redi]: ${id}`;
	decorator.toString = () => id
	decorator[IdentifierDecoratorSymbol] = true

	return decorator
}

/**
 * @internal
 */
/* istanbul ignore next */
export function TEST_ONLY_clearKnownIdentifiers(): void {
	knownIdentifiers.clear()
}
