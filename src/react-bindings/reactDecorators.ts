import { DependencyIdentifier, Quantity, LookUp, Injector, RediError } from '@wendellhu/redi'

class ClassComponentNotInRediContextError<T> extends RediError {
    constructor(component: React.Component<T>) {
        super(
            `You should make "RediContext" as ${component.constructor.name}'s default context type. ` +
                'If you want to use multiple context, please check this on React doc site. ' +
                'https://reactjs.org/docs/context.html#classcontexttype'
        )
    }
}

export function WithDependency<T>(id: DependencyIdentifier<T>, quantity?: Quantity, lookUp?: LookUp): any {
    return function () {
        return {
            get(): T | T[] | null {
                const thisComponent: React.Component<T> = this as any

                if (!thisComponent.context || !thisComponent.context.injector) {
                    throw new ClassComponentNotInRediContextError(thisComponent)
                }

                const injector: Injector = thisComponent.context.injector
                const thing = injector.get(id, quantity || Quantity.REQUIRED, lookUp)

                return thing
            },
        }
    }
}
