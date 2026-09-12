import {
  getInjectorDiscoveryMetadata,
  getInjectorDiscoverySnapshot,
  ignoreInjectorForDiscovery,
  Injector,
  mergeInjectorDiscoveryMetadata,
  registerInjectorForDiscovery,
  setInjectorDiscoveryMetadata,
} from '@wendellhu/redi';
import { afterEach, describe, expect, it } from 'bun:test';

describe('Injector Discovery', () => {
  const injectors: Injector[] = [];

  function createInjector(parent?: Injector): Injector {
    const injector = parent ? parent.createChild() : new Injector();
    injectors.push(injector);
    return injector;
  }

  function getRecord(injector: Injector) {
    return getInjectorDiscoverySnapshot().records.find(
      (record) => record.injector === injector,
    );
  }

  afterEach(() => {
    for (const injector of injectors.reverse()) {
      injector.dispose();
    }
    injectors.length = 0;
  });

  it('registers on construction and permanently unregisters on dispose', () => {
    const injector = createInjector();

    expect(getRecord(injector)?.injector).toBe(injector);

    injector.dispose();

    expect(getRecord(injector)).toBeUndefined();
    expect(registerInjectorForDiscovery(injector)).toBe(false);
    expect(ignoreInjectorForDiscovery(injector)).toBe(false);
    expect(getRecord(injector)).toBeUndefined();
  });

  it('reconstructs parent/child relationships across multiple roots', () => {
    const firstRoot = createInjector();
    const firstChild = createInjector(firstRoot);
    const secondChild = createInjector(firstRoot);
    const grandchild = createInjector(firstChild);
    const secondRoot = createInjector();

    const snapshot = getInjectorDiscoverySnapshot();
    const records = snapshot.records.filter((record) =>
      [firstRoot, firstChild, secondChild, grandchild, secondRoot].includes(
        record.injector,
      ),
    );
    const roots = snapshot.roots.filter((record) =>
      [firstRoot, secondRoot].includes(record.injector),
    );
    const firstRootRecord = records.find(
      (record) => record.injector === firstRoot,
    );
    const firstChildRecord = records.find(
      (record) => record.injector === firstChild,
    );
    const secondChildRecord = records.find(
      (record) => record.injector === secondChild,
    );
    const grandchildRecord = records.find(
      (record) => record.injector === grandchild,
    );

    expect(records).toHaveLength(5);
    expect(roots.map((record) => record.injector)).toEqual([
      firstRoot,
      secondRoot,
    ]);
    expect(firstRootRecord).toBeDefined();
    expect(firstChildRecord).toBeDefined();
    expect(secondChildRecord).toBeDefined();
    expect(grandchildRecord).toBeDefined();
    expect(firstRootRecord?.parent).toBeNull();
    expect(firstRootRecord?.children).toEqual([
      firstChildRecord!,
      secondChildRecord!,
    ]);
    expect(firstChildRecord?.parent).toBe(firstRootRecord);
    expect(firstChildRecord?.children).toEqual([grandchildRecord!]);
    expect(secondChildRecord?.parent).toBe(firstRootRecord);
    expect(grandchildRecord?.parent).toBe(firstChildRecord);
  });

  it('rejects parent overrides that would make Discovery cyclic', () => {
    const parent = new Injector();
    const child = parent.createChild();

    expect(() => registerInjectorForDiscovery(parent, child)).toThrow(
      'Injector Discovery parent relationships must form an acyclic forest.',
    );
    expect(() => registerInjectorForDiscovery(child, child)).toThrow(
      'Injector Discovery parent relationships must form an acyclic forest.',
    );

    const snapshot = getInjectorDiscoverySnapshot();
    const parentRecord = snapshot.records.find(
      (record) => record.injector === parent,
    )!;
    const childRecord = snapshot.records.find(
      (record) => record.injector === child,
    )!;
    expect(snapshot.roots).toContain(parentRecord);
    expect(parentRecord.children).toEqual([childRecord]);
    expect(childRecord.parent).toBe(parentRecord);
    parent.dispose();
  });

  it('rejects dead parents and releases discovery-only parent links on disposal', () => {
    const parent = new Injector();
    const child = new Injector();
    const liveChild = new Injector();
    registerInjectorForDiscovery(child, parent);
    registerInjectorForDiscovery(liveChild, parent);

    expect(getRecord(child)?.parent?.injector).toBe(parent);
    ignoreInjectorForDiscovery(child);
    parent.dispose();
    expect(getRecord(child)).toBeUndefined();
    registerInjectorForDiscovery(child);
    expect(getRecord(child)?.parent).toBeNull();
    expect(getRecord(liveChild)?.parent).toBeNull();

    expect(() => registerInjectorForDiscovery(child, parent)).toThrow(
      'Injector Discovery parents must be live Injector instances.',
    );
    child.dispose();
    liveChild.dispose();
  });

  it('ignores and explicitly restores an Injector with the same stable id', () => {
    const parent = createInjector();
    const child = createInjector(parent);
    const originalParentRecord = getRecord(parent)!;

    expect(ignoreInjectorForDiscovery(parent)).toBe(true);
    expect(ignoreInjectorForDiscovery(parent)).toBe(false);

    const ignoredSnapshot = getInjectorDiscoverySnapshot();
    const childWhileParentIgnored = ignoredSnapshot.records.find(
      (record) => record.injector === child,
    );
    expect(getRecord(parent)).toBeUndefined();
    expect(childWhileParentIgnored?.parent).toBeNull();
    expect(ignoredSnapshot.roots).toContain(childWhileParentIgnored!);

    expect(registerInjectorForDiscovery(parent)).toBe(true);

    const restoredSnapshot = getInjectorDiscoverySnapshot();
    const restoredParentRecord = restoredSnapshot.records.find(
      (record) => record.injector === parent,
    )!;
    const restoredChildRecord = restoredSnapshot.records.find(
      (record) => record.injector === child,
    )!;
    expect(restoredParentRecord.id).toBe(originalParentRecord.id);
    expect(restoredChildRecord.parent).toBe(restoredParentRecord);
    expect(restoredParentRecord.children).toEqual([restoredChildRecord]);

    expect(registerInjectorForDiscovery(child, null)).toBe(true);
    expect(getRecord(child)?.parent).toBeNull();
    expect(registerInjectorForDiscovery(child, parent)).toBe(true);
    expect(getRecord(child)?.parent?.injector).toBe(parent);
  });

  it('supports replacing and merging immutable enrichment metadata', () => {
    const injector = createInjector();
    const metadata: Record<string, unknown> = {
      source: 'react',
      subtree: 'settings',
    };

    expect(setInjectorDiscoveryMetadata(injector, metadata)).toBe(true);
    metadata.subtree = 'mutated outside';
    expect(
      mergeInjectorDiscoveryMetadata(injector, {
        provider: 'SettingsProvider',
        subtree: 'account',
      }),
    ).toBe(true);

    const snapshot = getInjectorDiscoverySnapshot();
    const record = snapshot.records.find(
      (record) => record.injector === injector,
    )!;

    expect(record.metadata).toEqual({
      provider: 'SettingsProvider',
      source: 'react',
      subtree: 'account',
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.records)).toBe(true);
    expect(Object.isFrozen(snapshot.roots)).toBe(true);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.children)).toBe(true);
    expect(Object.isFrozen(record.metadata!)).toBe(true);
    expect(getInjectorDiscoveryMetadata(injector)).toBe(record.metadata);

    expect(setInjectorDiscoveryMetadata(injector, undefined)).toBe(true);
    expect(getRecord(injector)?.metadata).toBeUndefined();

    injector.dispose();
    expect(setInjectorDiscoveryMetadata(injector, { source: 'late' })).toBe(
      false,
    );
    expect(mergeInjectorDiscoveryMetadata(injector, { source: 'late' })).toBe(
      false,
    );
  });

  it('reads the registry without instantiating dependencies', () => {
    let classInstantiations = 0;
    let factoryCalls = 0;

    class Service {
      constructor() {
        classInstantiations += 1;
      }
    }

    const injector = new Injector([
      [Service, { useClass: Service, lazy: true }],
      ['factory', { useFactory: () => (factoryCalls += 1) }],
    ]);
    injectors.push(injector);

    const snapshot = getInjectorDiscoverySnapshot();

    expect(
      snapshot.records.some((record) => record.injector === injector),
    ).toBe(true);
    expect(classInstantiations).toBe(0);
    expect(factoryCalls).toBe(0);
  });

  it('disposes every child once and removes the whole tree', () => {
    const parent = createInjector();
    const firstChild = createInjector(parent);
    const secondChild = createInjector(parent);
    const grandchild = createInjector(firstChild);
    const disposeCounts = new Map<Injector, number>();

    for (const injector of [parent, firstChild, secondChild, grandchild]) {
      disposeCounts.set(injector, 0);
      injector.onDispose(() => {
        disposeCounts.set(injector, disposeCounts.get(injector)! + 1);
      });
    }

    parent.dispose();
    parent.dispose();

    for (const injector of [parent, firstChild, secondChild, grandchild]) {
      expect(disposeCounts.get(injector)).toBe(1);
      expect(getRecord(injector)).toBeUndefined();
    }
  });
});
