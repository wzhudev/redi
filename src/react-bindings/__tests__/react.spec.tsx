/**
 * @vitest-environment jsdom
 */

import type { IDisposable } from '@wendellhu/redi';
import { act, fireEvent, render } from '@testing-library/react';
import { createIdentifier, Injector } from '@wendellhu/redi';
import {
  connectDependencies,
  connectInjector,
  RediContext,
  useDependency,
  useInjector,
  WithDependency,
} from '@wendellhu/redi/react-bindings';

import React from 'react';

import { afterEach, describe, expect, it } from 'vitest';
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

  it('should "withDependency" work', () => {
    interface A {
      key: string;
    }

    const aI = createIdentifier<A>('aI');

    const injector = new Injector([[aI, { useValue: { key: 'a' } }]]);

    class AppImpl extends React.Component {
      static override contextType = RediContext;

      @WithDependency(aI)
      private readonly _a!: A;

      override render() {
        return <div>{this._a.key}</div>;
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
      private readonly _a!: A;

      override render() {
        return <div>{this._a.key}</div>;
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
