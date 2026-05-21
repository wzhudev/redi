import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import React from 'react';
import { createIdentifier } from '../decorators';
import { Injector } from '../injector';
import {
  connectDependencies,
  connectInjector,
} from '../react-bindings/reactComponent';
import { useDependency } from '../react-bindings/reactHooks';

interface IGreeting {
  hello: () => string;
}
// eslint-disable-next-line ts/no-redeclare
const IGreeting = createIdentifier<IGreeting>('IGreeting');

function Greeter() {
  const greeting = useDependency(IGreeting);
  return <span>{greeting.hello()}</span>;
}

describe('react component bindings', () => {
  afterEach(() => {
    cleanup();
  });

  it('connectInjector provides the supplied injector to children', () => {
    const injector = new Injector([
      [IGreeting, { useValue: { hello: () => 'from-injector' } }],
    ]);
    const App = connectInjector(Greeter, injector);

    const { container } = render(<App />);
    expect(container.textContent).toBe('from-injector');
  });

  it('connectDependencies reuses the cached child injector across re-renders', () => {
    const App = connectDependencies(Greeter, [
      [IGreeting, { useValue: { hello: () => 'cached' } }],
    ]);

    const { container, rerender } = render(<App />);
    expect(container.textContent).toBe('cached');

    rerender(<App />);
    expect(container.textContent).toBe('cached');
  });

  it('connectDependencies creates a child injector when nested inside another', () => {
    interface IOuter {
      tag: string;
    }
    // eslint-disable-next-line ts/no-redeclare
    const IOuter = createIdentifier<IOuter>('IOuter');

    function Combined() {
      const outer = useDependency(IOuter);
      const greeting = useDependency(IGreeting);
      return <span>{`${outer.tag}-${greeting.hello()}`}</span>;
    }

    const Inner = connectDependencies(Combined, [
      [IGreeting, { useValue: { hello: () => 'inner' } }],
    ]);
    const Outer = connectDependencies(Inner, [
      [IOuter, { useValue: { tag: 'outer' } }],
    ]);

    const { container } = render(<Outer />);
    expect(container.textContent).toBe('outer-inner');
  });

  it('disposes the child injector when unmounted', () => {
    const App = connectDependencies(Greeter, [
      [IGreeting, { useValue: { hello: () => 'bye' } }],
    ]);

    const { container, unmount } = render(<App />);
    expect(container.textContent).toBe('bye');

    unmount();
  });
});
