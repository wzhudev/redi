import type { BenchCase } from '../harness';
import type { Dependency, DependencyIdentifier } from '../redi';
import { Injector } from '../redi';

interface InjectorHolder {
  injector: Injector | null;
}

/**
 * A case that resolves an already-primed dependency repeatedly, measuring the
 * cached/lookup path only.
 */
export function makeHotCase(
  group: string,
  name: string,
  registration: Dependency[],
  token: DependencyIdentifier<any>,
): BenchCase {
  return makeHotCaseFn(group, name, registration, (injector) =>
    injector.get(token));
}

/** Like {@link makeHotCase} but the measured work receives the injector. */
export function makeHotCaseFn(
  group: string,
  name: string,
  registration: Dependency[],
  work: (injector: Injector) => unknown,
  options: { batch?: number; async?: boolean } = {},
): BenchCase {
  const holder: InjectorHolder = { injector: null };

  return {
    group,
    name,
    batch: options.batch ?? 1000,
    async: options.async,
    beforeAll: () => {
      holder.injector = new Injector(registration);
      work(holder.injector);
    },
    afterAll: () => {
      holder.injector?.dispose();
      holder.injector = null;
    },
    fn: () => (holder.injector ? work(holder.injector) : undefined),
  };
}

/**
 * A case that builds a fresh injector before every iteration and resolves a
 * dependency for the first time, measuring cold traversal + instantiation.
 */
export function makeColdCase(
  group: string,
  name: string,
  registration: Dependency[],
  token: DependencyIdentifier<any>,
): BenchCase {
  return makeColdCaseFn(group, name, registration, (injector) =>
    injector.get(token));
}

/** Like {@link makeColdCase} but the measured work receives the injector. */
export function makeColdCaseFn(
  group: string,
  name: string,
  registration: Dependency[],
  work: (injector: Injector) => unknown,
): BenchCase {
  const holder: InjectorHolder = { injector: null };

  return {
    group,
    name,
    beforeEach: () => {
      holder.injector = new Injector(registration);
    },
    afterEach: () => {
      holder.injector?.dispose();
      holder.injector = null;
    },
    fn: () => (holder.injector ? work(holder.injector) : undefined),
  };
}
