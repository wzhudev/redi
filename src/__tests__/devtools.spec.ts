import {
  Inject,
  Injector,
  setInjectorDevtoolsHook,
  snapshotDependencyGraph,
} from '@wendellhu/redi';
import { afterEach, describe, expect, it } from 'vitest';
import { TEST_ONLY_clearKnownIdentifiers } from '../decorators';

function cleanupTest() {
  setInjectorDevtoolsHook(null);
  TEST_ONLY_clearKnownIdentifiers();
}

describe('devtools', () => {
  afterEach(() => cleanupTest());

  it('should report injector creation with parent info', () => {
    const created: Array<{ id: string; parentId: string | null }> = [];

    setInjectorDevtoolsHook({
      onInjectorCreated(injector, parent) {
        created.push({ id: injector.debugKey, parentId: parent ? parent.debugKey : null });
      },
    });

    const root = new Injector();
    const child = root.createChild();

    expect(created).toContainEqual({ id: root.debugKey, parentId: null });
    expect(created).toContainEqual({ id: child.debugKey, parentId: root.debugKey });
  });

  it('should report injector disposal in child-first order', () => {
    const disposed: string[] = [];

    setInjectorDevtoolsHook({
      onInjectorDisposed(injector) {
        disposed.push(injector.debugKey);
      },
    });

    const root = new Injector();
    const child = root.createChild();

    root.dispose();

    expect(disposed).toEqual([child.debugKey, root.debugKey]);
  });

  it('snapshotDependencyGraph should include cross-injector edges', () => {
    class A {}

    class B {
      constructor(@Inject(A) public a: A) {}
    }

    const root = new Injector([[A]]);
    const child = root.createChild([[B]]);

    const snap = snapshotDependencyGraph(root);

    const tokenA = snap.tokens.find((t) => t.label === 'A');
    const tokenB = snap.tokens.find((t) => t.label === 'B');

    expect(snap.injectors.length).toBe(2);
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();

    const edge = snap.edges.find((e) => e.from === tokenB!.key && e.to === tokenA!.key);
    expect(edge).toBeTruthy();

    // Root is only defined by `parent === null`
    const roots = snap.injectors.filter((i) => i.parentId === null);
    expect(roots.map((r) => r.id)).toEqual([root.debugKey]);
  });
});
