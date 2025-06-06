import type { DependencyIdentifier, LookUp } from '@wendellhu/redi';
import type { IRediContext } from './reactContext';
import { Quantity, RediError } from '@wendellhu/redi';

class ClassComponentNotInRediContextError<T> extends RediError {
  constructor(component: React.Component<T>) {
    super(
      `You should make "RediContext" as ${component.constructor.name}'s default context type. ` +
      'If you want to use multiple context, please check this on React doc site. ' +
      'https://reactjs.org/docs/context.html#classcontexttype',
    );
  }
}

export function WithDependency<T>(
  id: DependencyIdentifier<T>,
  quantity?: Quantity,
  lookUp?: LookUp,
): any {
  return function () {
    return {
      get(): T | T[] | null {
        const thisComponent: React.Component<T> = this as any;

        const context = thisComponent.context as IRediContext | null;
        if (!context || !context.injector) {
          throw new ClassComponentNotInRediContextError(thisComponent);
        }

        const injector = context.injector;
        const thing = injector.get(id, quantity || Quantity.REQUIRED, lookUp);

        return thing;
      },
    };
  };
}
