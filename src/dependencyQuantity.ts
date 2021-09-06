import { getDependencyByIndex, setDependency } from './decorators'
import { DependencyIdentifier } from './dependencyIdentifier'
import { Ctor } from './dependencyItem'

export enum Quantity {
    MANY = 'many',
    OPTIONAL = 'optional',
    REQUIRED = 'required',
}

class IdentifierUndefinedError extends Error {
    constructor(target: Ctor<any>, index: number) {
        const msg = `it seems that you register "undefined" as dependency on the ${
            index + 1
        } parameter of ${target}`

        super(msg)
    }
}

class QuantityCheckError extends Error {
    constructor(
        id: DependencyIdentifier<any>,
        quantity: Quantity,
        actual: number
    ) {
        const msg = `expect "${quantity}" dependency items for id "${id}" but get ${actual}`

        super(msg)
    }
}

export function checkQuantity(
    id: DependencyIdentifier<any>,
    quantity: Quantity,
    length: number
): void {
    if (
        (quantity === Quantity.OPTIONAL && length > 1) ||
        (quantity === Quantity.REQUIRED && length !== 1)
    ) {
        throw new QuantityCheckError(id, quantity, length)
    }
}

export function retrieveQuantity<T>(quantity: Quantity, arr: T[]): T[] | T {
    if (quantity === Quantity.MANY) {
        return arr
    } else {
        return arr[0]
    }
}

function changeQuantity(target: Ctor<any>, index: number, quantity: Quantity) {
    const descriptor = getDependencyByIndex(target, index)
    descriptor.quantity = quantity
}

function quantifyDecoratorFactoryProducer(quantity: Quantity) {
    return function decoratorFactory<T>(
        this: any,
        id?: DependencyIdentifier<T>
    ) {
        if (this instanceof decoratorFactory) {
            return this
        }

        return function (registerTarget: Ctor<T>, _key: string, index: number) {
            if (id) {
                setDependency(registerTarget, id, index, quantity)
            } else {
                if (quantity === Quantity.REQUIRED) {
                    throw new IdentifierUndefinedError(registerTarget, index)
                }

                changeQuantity(registerTarget, index, quantity)
            }
        }
    } as any
}

interface ManyDecorator {
    (id?: DependencyIdentifier<any>): any
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    new (): ManyDecorator
}
export const Many: ManyDecorator = quantifyDecoratorFactoryProducer(
    Quantity.MANY
)

interface OptionalDecorator {
    (id?: DependencyIdentifier<any>): any
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    new (): OptionalDecorator
}
export const Optional: OptionalDecorator = quantifyDecoratorFactoryProducer(
    Quantity.OPTIONAL
)

interface InjectDecorator {
    (id: DependencyIdentifier<any>): any
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    new (): InjectDecorator
}
export const Inject: InjectDecorator = quantifyDecoratorFactoryProducer(
    Quantity.REQUIRED
)
