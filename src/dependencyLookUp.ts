import type { Ctor } from './dependencyItem';
import { getDependencyByIndex } from './decorators';
import { LookUp } from './types';

function changeLookup(target: Ctor<any>, index: number, lookUp: LookUp) {
  const descriptor = getDependencyByIndex(target, index);
  descriptor.lookUp = lookUp;
}

function lookupDecoratorFactoryProducer(lookUp: LookUp) {
  return function DecoratorFactory<T>(this: any) {
    if (this instanceof DecoratorFactory) {
      return this;
    }

    return function (target: Ctor<T>, _key: string, index: number) {
      changeLookup(target, index, lookUp);
    };
  } as any;
}

interface SkipSelfDecorator {
  (): any;
  new (): SkipSelfDecorator;
}

/**
 * A parameter decorator that instructs the injector to skip the current
 * injector when resolving this dependency, and start the lookup from
 * the parent injector.
 *
 * This is useful when you want to get a dependency from a parent injector
 * even if the current injector has the same dependency registered.
 *
 * @example
 * ```typescript
 * class ChildService {
 *   constructor(
 *     @SkipSelf() @Inject(IConfig) private parentConfig: IConfig
 *   ) {}
 * }
 * ```
 */
export const SkipSelf: SkipSelfDecorator = lookupDecoratorFactoryProducer(LookUp.SKIP_SELF);

interface SelfDecorator {
  (): any;
  new (): SelfDecorator;
}

/**
 * A parameter decorator that instructs the injector to only look for
 * this dependency in the current injector, without searching parent injectors.
 *
 * If the dependency is not found in the current injector, an error will be thrown
 * (or `null` will be returned if used with `@Optional()`).
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(
 *     @Self() @Inject(ILocalConfig) private localConfig: ILocalConfig
 *   ) {}
 * }
 *
 * // With optional - returns null if not found locally
 * class MyService {
 *   constructor(
 *     @Self() @Optional(ILocalCache) private cache: ILocalCache | null
 *   ) {}
 * }
 * ```
 */
export const Self: SelfDecorator = lookupDecoratorFactoryProducer(LookUp.SELF);
