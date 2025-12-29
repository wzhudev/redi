import type { Injector } from '@wendellhu/redi';
import { createContext } from 'react';

/**
 * The shape of the RediContext value.
 */
export interface IRediContext {
  /** The current Injector instance, or null if not provided. */
  injector: Injector | null;
}

/**
 * React Context for dependency injection.
 *
 * This context provides access to the Injector instance throughout
 * the React component tree. Use `RediProvider` to provide an injector,
 * and `useDependency`/`useInjector` hooks to consume dependencies.
 *
 * For most use cases, prefer using `connectInjector` or `connectDependencies`
 * instead of using this context directly.
 *
 * @example
 * ```tsx
 * // Direct usage (advanced)
 * const injector = new Injector([[MyService]]);
 *
 * function App() {
 *   return (
 *     <RediContext.Provider value={{ injector }}>
 *       <MyComponent />
 *     </RediContext.Provider>
 *   );
 * }
 * ```
 */
export const RediContext = createContext<IRediContext>({
  injector: null,
});
RediContext.displayName = 'RediContext';

/**
 * Provider component for RediContext.
 *
 * Use this to provide an Injector to the component tree.
 * Prefer using `connectInjector` or `connectDependencies` for simpler usage.
 */
export const RediProvider = RediContext.Provider;

/**
 * Consumer component for RediContext.
 *
 * Use this to access the injector in class components or render props patterns.
 * For functional components, prefer using `useInjector` hook instead.
 */
export const RediConsumer = RediContext.Consumer;
