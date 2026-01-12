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

/**
 * A property decorator for React class components that injects a dependency.
 *
 * This decorator creates a getter that lazily retrieves the dependency
 * from the component's context. The component must have `RediContext`
 * set as its `contextType`.
 *
 * For functional components, use the `useDependency` hook instead.
 *
 * @param id - The dependency identifier.
 * @param quantity - Optional quantity (REQUIRED, OPTIONAL, or MANY).
 * @param lookUp - Optional lookup strategy (SELF or SKIP_SELF).
 *
 * @example
 * ```tsx
 * class MyComponent extends React.Component {
 *   static contextType = RediContext;
 *
 *   @WithDependency(UserService)
 *   private userService!: UserService;
 *
 *   @WithDependency(ICache, Quantity.OPTIONAL)
 *   private cache!: ICache | null;
 *
 *   render() {
 *     return <div>{this.userService.getCurrentUser().name}</div>;
 *   }
 * }
 * ```
 */
export function WithDependency<T>(id: DependencyIdentifier<T>, quantity?: Quantity, lookUp?: LookUp): any {
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
