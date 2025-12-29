import type { Ctor } from './dependencyItem';
import { getDependencyByIndex } from './decorators';

function changeToSelf(target: Ctor<any>, index: number, withNew: boolean) {
  const descriptor = getDependencyByIndex(target, index);
  descriptor.withNew = withNew;
}

function withNewDecoratorFactoryProducer(withNew: boolean) {
  return function DecoratorFactory<T>(this: any) {
    if (this instanceof DecoratorFactory) {
      return this;
    }

    return function (target: Ctor<T>, _key: string, index: number) {
      changeToSelf(target, index, withNew);
    };
  } as any;
}

interface ToSelfDecorator {
  (): any;
  new (): ToSelfDecorator;
}

/**
 * A parameter decorator that instructs the injector to always create
 * a new instance of the dependency instead of returning the cached singleton.
 *
 * By default, dependencies are singletons within an injector. Using `@WithNew()`
 * will create a fresh instance each time it's injected.
 *
 * @example
 * ```typescript
 * class RequestHandler {
 *   constructor(
 *     // Each RequestHandler gets its own RequestContext
 *     @WithNew() @Inject(RequestContext) private context: RequestContext
 *   ) {}
 * }
 *
 * // Without @WithNew, all RequestHandlers would share the same context
 * ```
 */
export const WithNew: ToSelfDecorator = withNewDecoratorFactoryProducer(true);
