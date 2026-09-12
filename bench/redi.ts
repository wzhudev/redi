export {
  getDependencyByIndex,
  TEST_ONLY_clearKnownIdentifiers,
} from '../src/decorators';
/**
 * Single entry point for benchmark code to import redi from.
 *
 * Benchmarks exercise the source files so results map directly to the code
 * under development. A future iteration may add a `dist` target.
 */
export * from '../src/index';
