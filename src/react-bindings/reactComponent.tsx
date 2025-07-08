import type { Dependency } from '@wendellhu/redi';
import { Injector } from '@wendellhu/redi';
import React, { useEffect, useRef } from 'react';
import { RediConsumer, RediProvider } from './reactContext';

function RediInjector(
  props: React.PropsWithChildren<{ dependencies: Dependency[] }>,
) {
  const { children, dependencies } = props;
  const childInjectorRef = useRef<Injector | null>(null);

  // dispose the injector when the container Injector unmounts
  useEffect(() => () => childInjectorRef.current?.dispose(), []);

  return (
    <RediConsumer>
      {(context: { injector: Injector | null }) => {
        let childInjector: Injector;

        if (childInjectorRef.current) {
          childInjector = childInjectorRef.current;
        } else {
          childInjector = context.injector
            ? context.injector.createChild(dependencies)
            : new Injector(dependencies);

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
 * @param Comp
 * @param injector
 * @returns A component type that can be rendered.
 */
export function connectInjector<P>(
  Comp: React.ComponentType<P>,
  injector: Injector,
): React.ComponentType<P> {
  return function ComponentWithInjector(props: P) {
    return (
      <RediProvider value={{ injector }}>
        <Comp {...(props as P & React.JSX.IntrinsicAttributes)} />
      </RediProvider>
    );
  };
}

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
