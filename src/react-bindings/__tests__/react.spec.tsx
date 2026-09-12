import type { IDisposable } from '@wendellhu/redi';
import { act, fireEvent, render } from '@testing-library/react';
import {
  createIdentifier,
  getInjectorDiscoverySnapshot,
  ignoreInjectorForDiscovery,
  Injector,
  registerInjectorForDiscovery,
  setInjectorDiscoveryMetadata,
} from '@wendellhu/redi';
import {
  connectDependencies,
  connectInjector,
  RediContext,
  RediProvider,
  useDependency,
  useInjector,
  WithDependency,
} from '@wendellhu/redi/react-bindings';

import { afterEach, describe, expect, it } from 'bun:test';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { expectToThrow } from '../../__testing__/expectToThrow';
import { TEST_ONLY_clearKnownIdentifiers } from '../../decorators';

describe('react', () => {
  afterEach(() => {
    TEST_ONLY_clearKnownIdentifiers();
  });

  it('should "connectInjector" work', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    const injector = new Injector([[aI, { useValue: { key: 'a' } }]]);

    const App = connectInjector(() => {
      const j = useInjector();
      const a = j.get(aI);

      return <div>{a.key}</div>;
    }, injector);

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('a');
  });

  it('should "connectDependencies" work', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    const App = connectDependencies(() => {
      const j = useInjector();
      const a = j.get(aI);

      return <div>{a.key}</div>;
    }, [[aI, { useValue: { key: 'a' } }]]);

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('a');
  });

  it('enriches a connected external injector after commit without owning it', () => {
    const valueIdentifier = createIdentifier<string>('discovery-value');
    const injector = new Injector([
      [valueIdentifier, { useValue: 'still-live' }],
    ]);
    setInjectorDiscoveryMetadata(injector, { owner: 'external' });

    function DiscoveryApp() {
      return <div>discovery</div>;
    }

    const App = connectInjector(DiscoveryApp, injector);
    renderToString(<App />);

    const getRecord = () =>
      getInjectorDiscoverySnapshot().records.find(
        (record) => record.injector === injector,
      );

    expect(getRecord()?.metadata).toEqual({ owner: 'external' });

    const { unmount } = render(<App />);
    expect(getRecord()?.metadata).toEqual({
      owner: 'external',
      react: {
        componentName: 'DiscoveryApp',
        source: 'connectInjector',
      },
    });
    expect(Object.isFrozen(getRecord()?.metadata?.react)).toBe(true);

    unmount();
    expect(injector.get(valueIdentifier)).toBe('still-live');
    expect(getRecord()?.injector).toBe(injector);
    expect(getRecord()?.metadata).toEqual({ owner: 'external' });
    injector.dispose();
  });

  it('keeps external React hints scoped across overlapping providers', () => {
    const injector = new Injector();
    setInjectorDiscoveryMetadata(injector, {
      owner: 'shared',
      react: { componentName: 'Baseline', source: 'manual' },
    });

    function FirstProviderTree() {
      return <div>first</div>;
    }
    function SecondProviderTree() {
      return <div>second</div>;
    }

    const First = connectInjector(FirstProviderTree, injector);
    const Second = connectInjector(SecondProviderTree, injector);
    const first = render(<First />);
    const second = render(<Second />);
    const getMetadata = () =>
      getInjectorDiscoverySnapshot().records.find(
        (record) => record.injector === injector,
      )?.metadata;

    expect(getMetadata()?.react).toEqual({
      componentName: 'SecondProviderTree',
      source: 'connectInjector',
    });
    first.unmount();
    expect(getMetadata()?.react).toEqual({
      componentName: 'SecondProviderTree',
      source: 'connectInjector',
    });
    second.unmount();
    expect(getMetadata()).toEqual({
      owner: 'shared',
      react: { componentName: 'Baseline', source: 'manual' },
    });
    injector.dispose();
  });

  it('preserves hidden metadata while enriching an ignored injector', () => {
    const injector = new Injector();
    setInjectorDiscoveryMetadata(injector, { owner: 'keep' });
    ignoreInjectorForDiscovery(injector);

    function IgnoredProviderTree() {
      return <div>ignored</div>;
    }

    const App = connectInjector(IgnoredProviderTree, injector);
    const mounted = render(<App />);
    registerInjectorForDiscovery(injector);
    const getMetadata = () =>
      getInjectorDiscoverySnapshot().records.find(
        (record) => record.injector === injector,
      )?.metadata;

    expect(getMetadata()).toEqual({
      owner: 'keep',
      react: {
        componentName: 'IgnoredProviderTree',
        source: 'connectInjector',
      },
    });
    mounted.unmount();
    expect(getMetadata()).toEqual({ owner: 'keep' });
    injector.dispose();
  });

  it('enriches and disposes an owned injector across StrictMode replay', async () => {
    const valueIdentifier = createIdentifier<string>('strict-value');
    const recordsBeforeMount = getInjectorDiscoverySnapshot().records;
    let injector: Injector | null = null;

    function StrictDiscoveryApp() {
      injector = useInjector();
      return <div>{injector.get(valueIdentifier)}</div>;
    }

    const App = connectDependencies(StrictDiscoveryApp, [
      [valueIdentifier, { useValue: 'strict-live' }],
    ]);
    const { container, unmount } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    const ownedInjector = injector!;

    expect(container.textContent).toBe('strict-live');
    expect(ownedInjector.get(valueIdentifier)).toBe('strict-live');
    expect(getInjectorDiscoverySnapshot().records).toHaveLength(
      recordsBeforeMount.length + 1,
    );
    expect(
      getInjectorDiscoverySnapshot().records.find(
        (record) => record.injector === ownedInjector,
      )?.metadata,
    ).toEqual({
      react: {
        componentName: 'StrictDiscoveryApp',
        source: 'connectDependencies',
      },
    });

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(
      getInjectorDiscoverySnapshot().records.some(
        (record) => record.injector === ownedInjector,
      ),
    ).toBe(false);
    expect(getInjectorDiscoverySnapshot().records).toHaveLength(
      recordsBeforeMount.length,
    );
  });

  it('does not retain an owned injector when render aborts before commit', () => {
    const recordsBeforeRender = getInjectorDiscoverySnapshot().records;
    const valueIdentifier = createIdentifier<string>('aborted-render-value');

    const App = connectDependencies(() => {
      useDependency(valueIdentifier);
      throw new Error('abort render');
    }, [[valueIdentifier, { useValue: 'created-during-render' }]]);

    expectToThrow(() => render(<App />));
    expect(getInjectorDiscoverySnapshot().records).toHaveLength(
      recordsBeforeRender.length,
    );
  });

  it('does not attach an aborted child candidate to a long-lived parent', () => {
    let disposed = 0;

    class RenderScopedService implements IDisposable {
      dispose(): void {
        disposed += 1;
      }
    }

    const parent = new Injector();
    const recordsBeforeRender = getInjectorDiscoverySnapshot().records.length;
    const App = connectDependencies(() => {
      useDependency(RenderScopedService);
      throw new Error('abort child render');
    }, [[RenderScopedService]]);

    expectToThrow(() =>
      render(
        <RediProvider value={{ injector: parent }}>
          <App />
        </RediProvider>,
      ),
    );
    expect(getInjectorDiscoverySnapshot().records).toHaveLength(
      recordsBeforeRender,
    );

    parent.dispose();
    expect(disposed).toBe(0);
  });

  it('should "withDependency" work', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    const injector = new Injector([[aI, { useValue: { key: 'a' } }]]);

    class AppImpl extends React.Component {
      static override contextType = RediContext;

      @WithDependency(aI)
      private readonly a!: A;

      override render() {
        return <div>{this.a.key}</div>;
      }
    }

    const App = connectInjector(AppImpl, injector);

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('a');
  });

  it('should "useDependency" work', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    function AppImpl() {
      const a = useDependency(aI);
      return <div>{a.key}</div>;
    }

    const injector = new Injector([[aI, { useValue: { key: 'a' } }]]);
    const App = connectInjector(AppImpl, injector);

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('a');
  });

  it('should throw error when using "useInjector" outside of "RediContext"', () => {
    function App() {
      useInjector();

      return <div>a</div>;
    }

    expectToThrow(() => render(<App />));
  });

  it('should throw error when using "WithDependency" outside of "RediContext"', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    const injector = new Injector([[aI, { useValue: { key: 'a' } }]]);

    class AppImpl extends React.Component {
      @WithDependency(aI)
      private readonly a!: A;

      override render() {
        return <div>{this.a.key}</div>;
      }
    }

    const App = connectInjector(AppImpl, injector);

    expectToThrow(() => render(<App />));
  });

  it('should dispose injector when React component unmounts', async () => {
    let disposed = false;

    class A implements IDisposable {
      key = 'a';

      public dispose(): void {
        disposed = true;
      }
    }

    const Child = connectDependencies(() => {
      const j = useInjector();
      const a = j.get(A);
      return <div>{a.key}</div>;
    }, [[A]]);

    function App() {
      const [mounted, setMounted] = React.useState(true);

      return (
        <div>
          <button onClick={() => setMounted(false)}></button>
          {mounted && <Child />}
        </div>
      );
    }

    const { container } = render(<App />);
    await act(() => {
      fireEvent.click(container.firstElementChild!.firstElementChild!);
      return new Promise<void>((res) => setTimeout(res, 20));
    });

    expect(disposed).toBe(true);
  });
});
