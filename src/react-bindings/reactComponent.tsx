import type { Dependency, InjectorDiscoveryMetadata } from '@wendellhu/redi';
import {
  getInjectorDiscoveryMetadata,
  Injector,
  setInjectorDiscoveryMetadata,
} from '@wendellhu/redi';
import React, { useEffect, useRef } from 'react';
import { RediConsumer, RediProvider } from './reactContext';

type ReactDiscoverySource = 'connectDependencies' | 'connectInjector';

interface ReactDiscoveryAssociations {
  readonly baseline: unknown;
  readonly hints: Map<symbol, unknown>;
}

const reactDiscoveryAssociations = new WeakMap<
  Injector,
  ReactDiscoveryAssociations
>();

function readDiscoveryMetadata(
  injector: Injector,
): InjectorDiscoveryMetadata | undefined {
  return getInjectorDiscoveryMetadata(injector);
}

function publishReactDiscoveryHint(
  injector: Injector,
  react: unknown,
): void {
  const metadata = { ...(readDiscoveryMetadata(injector) ?? {}) };
  if (react === undefined) {
    delete metadata.react;
  } else {
    metadata.react = react;
  }
  setInjectorDiscoveryMetadata(injector, metadata);
}

function associateReactDiscoveryHint(
  injector: Injector,
  associationId: symbol,
  metadata: InjectorDiscoveryMetadata,
): () => void {
  let associations = reactDiscoveryAssociations.get(injector);
  if (!associations) {
    associations = {
      baseline: readDiscoveryMetadata(injector)?.react,
      hints: new Map(),
    };
    reactDiscoveryAssociations.set(injector, associations);
  }

  associations.hints.set(associationId, metadata.react);
  publishReactDiscoveryHint(injector, metadata.react);

  return () => {
    const current = reactDiscoveryAssociations.get(injector);
    if (!current || !current.hints.delete(associationId)) return;
    const remaining = [...current.hints.values()];
    if (remaining.length > 0) {
      publishReactDiscoveryHint(injector, remaining[remaining.length - 1]);
    } else {
      publishReactDiscoveryHint(injector, current.baseline);
      reactDiscoveryAssociations.delete(injector);
    }
  };
}

function createReactDiscoveryMetadata<P>(
  source: ReactDiscoverySource,
  Comp: React.ComponentType<P>,
): InjectorDiscoveryMetadata {
  return Object.freeze({
    react: Object.freeze({
      source,
      componentName: Comp.displayName || Comp.name || 'Anonymous',
    }),
  });
}

function RediInjector(
  props: React.PropsWithChildren<{
    dependencies: Dependency[];
    discoveryMetadata: InjectorDiscoveryMetadata;
  }>,
) {
  const { children, dependencies, discoveryMetadata } = props;
  const childInjectorRef = useRef<Injector | null>(null);
  const detachedInjectorRef = useRef<ReturnType<
    typeof Injector.createDetached
  > | null>(null);
  const discoveryAssociationRef = useRef(Symbol('redi-react-provider'));
  const lifecycleGenerationRef = useRef(0);

  useEffect(() => {
    const childInjector = childInjectorRef.current!;
    const lifecycleGeneration = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = lifecycleGeneration;
    detachedInjectorRef.current!.attach();
    const removeDiscoveryHint = associateReactDiscoveryHint(
      childInjector,
      discoveryAssociationRef.current,
      discoveryMetadata,
    );

    return () => {
      removeDiscoveryHint();
      // StrictMode immediately replays effects in development. Waiting for the
      // replay prevents its simulated cleanup from disposing the live injector.
      queueMicrotask(() => {
        if (lifecycleGenerationRef.current === lifecycleGeneration) {
          childInjector.dispose();
        }
      });
    };
  }, [discoveryMetadata]);

  return (
    <RediConsumer>
      {(context: { injector: Injector | null }) => {
        let childInjector: Injector;

        /* istanbul ignore next -- @preserve */
        if (childInjectorRef.current) {
          childInjector = childInjectorRef.current;
        } else {
          // React may abandon or replay render before committing an effect.
          // A detached candidate can resolve through its parent but is not
          // strongly retained by either the parent or Discovery until commit.
          const detachedInjector = Injector.createDetached(
            dependencies,
            context.injector,
          );
          detachedInjectorRef.current = detachedInjector;
          childInjector = detachedInjector.injector;
          childInjectorRef.current = childInjector;
        }

        return (
          <RediProvider value={{ injector: childInjector }}>
            {children}
          </RediProvider>
        );
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
export function connectInjector<P>(
  Comp: React.ComponentType<P>,
  injector: Injector,
): React.ComponentType<P> {
  const discoveryMetadata = createReactDiscoveryMetadata(
    'connectInjector',
    Comp,
  );

  return function ComponentWithInjector(props: P) {
    const discoveryAssociationRef = useRef(Symbol('redi-react-provider'));

    useEffect(() => {
      return associateReactDiscoveryHint(
        injector,
        discoveryAssociationRef.current,
        discoveryMetadata,
      );
    }, [discoveryMetadata, injector]);

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
  const discoveryMetadata = createReactDiscoveryMetadata(
    'connectDependencies',
    Comp,
  );

  return function ComponentWithInjector(props: P) {
    return (
      <RediInjector
        dependencies={dependencies}
        discoveryMetadata={discoveryMetadata}
      >
        <Comp {...(props as P & React.JSX.IntrinsicAttributes)} />
      </RediInjector>
    );
  };
}
