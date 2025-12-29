import type { Ctor } from './dependencyItem';
import { setDependency } from './decorators';
import { Injector } from './injector';
import { LookUp, Quantity } from './types';

interface InjectSelfDecorator {
  (): any;
  new (): InjectSelfDecorator;
}

/**
 * A parameter decorator that injects the current Injector instance itself.
 *
 * This allows a class to access the injector that created it, which can be
 * useful for dynamic dependency resolution or creating child injectors.
 *
 * The injector is looked up with `LookUp.SELF`, meaning only the current
 * injector (not parent injectors) will be returned.
 *
 * @example
 * ```typescript
 * class ServiceFactory {
 *   constructor(@InjectSelf() private injector: Injector) {}
 *
 *   createService<T>(id: DependencyIdentifier<T>): T {
 *     return this.injector.createInstance(id);
 *   }
 *
 *   createChildScope(deps: Dependency[]): Injector {
 *     return this.injector.createChild(deps);
 *   }
 * }
 * ```
 */
export const InjectSelf: InjectSelfDecorator = function InjectSelf<T>() {
  return function (registerTarget: Ctor<T>, _key: string, index: number) {
    setDependency(
      registerTarget,
      Injector,
      index,
      Quantity.REQUIRED,
      LookUp.SELF,
    );
  };
} as any;
