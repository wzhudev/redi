import type { Dependency } from '@wendellhu/redi';
import { Injector } from '@wendellhu/redi';
import React, { useEffect, useRef } from 'react';
import { RediConsumer, RediProvider } from './reactContext';

function RediInjector(props: React.PropsWithChildren<{ dependencies: Dependency[] }>) {
  const { children, dependencies } = props;
  const childInjectorRef = useRef<Injector | null>(null);

  // dispose the injector when the container Injector unmounts
  useEffect(() => () => childInjectorRef.current?.dispose(), []);

  return (
    <RediConsumer>
      {(context: { injector: Injector | null }) => {
        let childInjector: Injector;

        /* istanbul ignore next -- @preserve */
        if (childInjectorRef.current) {
          childInjector = childInjectorRef.current;
        } else {
          childInjector = context.injector ? context.injector.createChild(dependencies) : new Injector(dependencies);

          childInjectorRef.current = childInjector;
        }

        return <RediProvider value={{ injector: childInjector }}>{children}</RediProvider>;
      }}
    </RediConsumer>
  );
}

/**
 * Connect a React component to a specific Injector instance.
 *
 * Wraps the component with a RediProvider, making the injector available
 * to all child components via `useDependency` and `useInjector` hooks.
 *
 * Use this when you have an existing Injector instance that you want
 * to make available to a React component tree.
 *
 * @param Comp - The React component to wrap.
 * @param injector - The Injector instance to provide.
 * @returns A new component that provides the injector via context.
 *
 * @example
 * ```tsx
 * const injector = new Injector([[UserService], [ILogger, { useClass: ConsoleLogger }]]);
 *
 * const App = connectInjector(MyApp, injector);
 *
 * // Now MyApp and all its children can use useDependency
 * ReactDOM.render(<App />, document.getElementById('root'));
 * ```
 */
export function connectInjector<P>(Comp: React.ComponentType<P>, injector: Injector): React.ComponentType<P> {
  return function ComponentWithInjector(props: P) {
    return (
      <RediProvider value={{ injector }}>
        <Comp {...(props as P & React.JSX.IntrinsicAttributes)} />
      </RediProvider>
    );
  };
}

/**
 * Connect a React component with a set of dependencies.
 *
 * Creates a new Injector (or child injector if inside an existing context)
 * with the specified dependencies, and provides it to the component tree.
 *
 * The injector is automatically disposed when the component unmounts.
 *
 * @param Comp - The React component to wrap.
 * @param dependencies - An array of dependencies to register.
 * @returns A new component that provides the dependencies via context.
 *
 * @example
 * ```tsx
 * const App = connectDependencies(MyApp, [
 *   [UserService],
 *   [ILogger, { useClass: ConsoleLogger }],
 *   [IConfig, { useValue: { apiUrl: 'https://api.example.com' } }],
 * ]);
 *
 * // MyApp and children can now use these dependencies
 * function MyApp() {
 *   const userService = useDependency(UserService);
 *   return <div>{userService.getCurrentUser().name}</div>;
 * }
 * ```
 */
export function connectDependencies<P>(
  Comp: React.ComponentType<P>,
  dependencies: Dependency[],
): React.ComponentType<P> {
  return function ComponentWithInjector(props: P) {
    return (
      <RediInjector dependencies={dependencies}>
        <Comp {...(props as P & React.JSX.IntrinsicAttributes)} />
      </RediInjector>
    );
  };
}
