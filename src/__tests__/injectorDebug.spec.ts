import { describe, expect, it } from 'bun:test';
import {
  createIdentifier,
  forwardRef,
  Inject,
  Injector,
  LookUp,
  Many,
  Optional,
  Quantity,
  Self,
  SkipSelf,
  WithNew,
} from '..';

describe('injector.debug', () => {
  it('lists provider details and creation state without resolving anything', () => {
    let constructed = 0;

    class Dependency {}
    class BareService {
      constructor(@Inject(Dependency) _dependency: Dependency) {
        constructed += 1;
      }
    }
    class LazyService {
      constructor() {
        constructed += 1;
      }
    }

    const classToken = createIdentifier<LazyService>('debug-list-class');
    const valueToken = createIdentifier<number>('debug-list-value');
    const undefinedValueToken = createIdentifier<undefined>(
      'debug-list-undefined-value',
    );
    const factoryToken = createIdentifier<number>('debug-list-factory');
    const existingToken = createIdentifier<number>('debug-list-existing');
    const asyncToken = createIdentifier<number>('debug-list-async');
    const manyToken = createIdentifier<number>('debug-list-many');
    const instanceToken = createIdentifier<{ ready: boolean }>(
      'debug-list-instance',
    );
    const injector = new Injector([
      [Dependency],
      [BareService],
      [classToken, { lazy: true, useClass: LazyService }],
      [valueToken, { useValue: 1 }],
      [undefinedValueToken, { useValue: undefined }],
      [
        factoryToken,
        {
          deps: [valueToken],
          dynamic: true,
          useFactory: function createNumber(value: number) {
            return value + 1;
          },
        },
      ],
      [existingToken, { useExisting: valueToken }],
      [asyncToken, { useAsync: async () => 3 }],
      [manyToken, { useValue: 4 }],
      [manyToken, { useFactory: () => 5 }],
    ]);
    injector.add([instanceToken, { ready: true }]);

    const groups = injector.debug.listRegistrations();
    const find = (identifier: unknown) =>
      groups.find((group) => group.identifier === identifier)!;

    expect(find(BareService).registrations[0]).toMatchObject({
      providerKind: 'class',
      providerLabel: 'BareService',
      status: 'not-created',
    });
    expect(find(BareService).registrations[0].dependencies).toEqual([
      expect.objectContaining({
        identifier: Dependency,
        identifierLabel: 'Dependency',
        paramIndex: 0,
        quantity: Quantity.REQUIRED,
        withNew: false,
      }),
    ]);
    expect(find(classToken).registrations[0]).toMatchObject({
      lazy: true,
      providerKind: 'class',
      status: 'not-created',
    });
    expect(find(valueToken).registrations[0]).toMatchObject({
      providerKind: 'value',
      status: 'not-created',
    });
    expect(find(undefinedValueToken).registrations[0]).toMatchObject({
      providerKind: 'value',
      providerLabel: 'value',
      status: 'not-created',
    });
    expect(find(factoryToken).registrations[0]).toMatchObject({
      dynamic: true,
      providerKind: 'factory',
      providerLabel: 'createNumber',
    });
    expect(find(factoryToken).registrations[0].dependencies[0]).toMatchObject({
      identifier: valueToken,
      quantity: Quantity.REQUIRED,
    });
    expect(find(existingToken).registrations[0]).toMatchObject({
      providerKind: 'existing',
      providerLabel: 'alias of debug-list-value',
    });
    expect(find(existingToken).registrations[0].dependencies[0]).toMatchObject({
      identifier: valueToken,
      quantity: Quantity.REQUIRED,
    });
    expect(find(asyncToken).registrations[0]).toMatchObject({
      dependencies: [],
      providerKind: 'async',
      status: 'pending',
    });
    expect(find(manyToken).registrations).toHaveLength(2);
    expect(find(instanceToken).registrations[0]).toMatchObject({
      providerKind: 'instance',
      status: 'created',
    });
    expect(constructed).toBe(0);

    const firstIds = groups.flatMap((group) =>
      group.registrations.map((registration) => registration.id),
    );
    const secondIds = injector.debug
      .listRegistrations()
      .flatMap((group) =>
        group.registrations.map((registration) => registration.id),
      );
    expect(secondIds).toEqual(firstIds);

    injector.get(valueToken);
    expect(injector.get(undefinedValueToken)).toBeUndefined();
    expect(
      injector.debug
        .listRegistrations()
        .find((group) => group.identifier === valueToken)!.registrations[0]
        .status,
    ).toBe('created');
    expect(constructed).toBe(0);
    injector.dispose();
  });

  it('normalizes forward references in alias labels and resolution', () => {
    class ForwardTarget {}

    const alias = createIdentifier<ForwardTarget>('debug-forward-alias');
    const injector = new Injector([
      [ForwardTarget],
      [alias, { useExisting: forwardRef(() => ForwardTarget) }],
    ]);

    expect(
      injector.debug
        .listRegistrations()
        .find((group) => group.identifier === alias)!.registrations[0]
        .providerLabel,
    ).toBe('alias of ForwardTarget');
    expect(injector.get(alias)).toBe(injector.get(ForwardTarget));
    injector.dispose();
  });

  it('keeps distinct stable ids across duplicate add, replace, and delete', () => {
    const token = createIdentifier<number>('debug-registration-identity');
    const sharedItem = { useValue: 1 };
    const injector = new Injector();

    injector.add([token, sharedItem]);
    injector.add([token, sharedItem]);
    const before = injector.debug.listRegistrations()[0];
    expect(before.registrations[0].id).not.toBe(before.registrations[1].id);
    expect(injector.debug.listRegistrations()[0].registrations).toEqual(
      before.registrations,
    );

    injector.delete(token);
    expect(injector.debug.listRegistrations()).toEqual([]);
    injector.replace([token, { useValue: 2 }]);
    expect(injector.debug.listRegistrations()[0].registrations[0].id).not.toBe(
      before.registrations[0].id,
    );
    injector.dispose();
  });

  it('explains hierarchy, quantities, aliases, built-ins, and withNew', () => {
    const serviceToken = createIdentifier<{ owner: string }>(
      'debug-explain-service',
    );
    const manyToken = createIdentifier<number>('debug-explain-many');
    const aliasToken = createIdentifier<{ owner: string }>(
      'debug-explain-alias',
    );
    const missingToken = createIdentifier<unknown>('debug-explain-missing');
    const instanceToken = createIdentifier<{ owner: string }>(
      'debug-explain-instance',
    );
    const optionalConsumer = createIdentifier<unknown>(
      'debug-explain-optional-consumer',
    );
    const manyConsumer = createIdentifier<unknown>(
      'debug-explain-many-consumer',
    );
    const withNewConsumer = createIdentifier<unknown>(
      'debug-explain-with-new-consumer',
    );
    let creations = 0;
    const parent = new Injector([
      [
        serviceToken,
        {
          useFactory: () => {
            creations += 1;
            return { owner: 'parent' };
          },
        },
      ],
      [manyToken, { useValue: 1 }],
      [manyToken, { useValue: 2 }],
      [aliasToken, { useExisting: serviceToken }],
      [instanceToken, { useFactory: () => ({ owner: 'parent-new' }) }],
    ]);
    const child = parent.createChild([
      [serviceToken, { useValue: { owner: 'child' } }],
      [
        optionalConsumer,
        {
          deps: [[new Optional(), new Self(), missingToken]],
          useFactory: (value: unknown) => value,
        },
      ],
      [
        manyConsumer,
        {
          deps: [[new Many(), new Self(), missingToken]],
          useFactory: (value: unknown) => value,
        },
      ],
      [
        withNewConsumer,
        {
          deps: [[new WithNew(), new Self(), instanceToken]],
          useFactory: (value: unknown) => value,
        },
      ],
    ]);
    child.add([instanceToken, { owner: 'child-instance' }]);

    const childGroup = child.debug
      .listRegistrations()
      .find((group) => group.identifier === serviceToken)!;
    const parentGroup = parent.debug
      .listRegistrations()
      .find((group) => group.identifier === serviceToken)!;

    expect(child.debug.explain({ identifier: serviceToken })).toMatchObject({
      landing: {
        groupId: childGroup.id,
        injector: child,
        registrationIds: [childGroup.registrations[0].id],
      },
      outcome: 'resolved',
    });
    expect(
      child.debug.explain({
        identifier: serviceToken,
        lookUp: LookUp.SKIP_SELF,
      }),
    ).toMatchObject({
      landing: {
        groupId: parentGroup.id,
        injector: parent,
      },
      outcome: 'resolved',
    });
    expect(
      child.debug.explain({
        identifier: serviceToken,
        lookUp: LookUp.SELF,
      }).outcome,
    ).toBe('resolved');
    expect(
      child.debug.explain({
        identifier: missingToken,
        lookUp: LookUp.SELF,
        quantity: Quantity.OPTIONAL,
      }).outcome,
    ).toBe('optional-missing');
    expect(
      child.debug.explain({
        identifier: missingToken,
        lookUp: LookUp.SELF,
        quantity: Quantity.MANY,
      }).outcome,
    ).toBe('many-empty');
    expect(child.debug.explain({ identifier: missingToken }).outcome).toBe(
      'required-missing',
    );
    expect(
      child.debug.explain({
        identifier: manyToken,
        quantity: Quantity.MANY,
      }),
    ).toMatchObject({
      landing: { injector: parent, registrationIds: expect.any(Array) },
      outcome: 'resolved',
    });
    expect(child.debug.explain({ identifier: manyToken })).toMatchObject({
      actual: 2,
      outcome: 'quantity-mismatch',
    });
    expect(
      child.debug.explain({
        identifier: manyToken,
        quantity: Quantity.OPTIONAL,
      }),
    ).toMatchObject({ actual: 2, outcome: 'quantity-mismatch' });

    const aliasRegistration = parent.debug
      .listRegistrations()
      .find((group) => group.identifier === aliasToken)!
.registrations[0];
    expect(aliasRegistration.dependencies[0].identifier).toBe(serviceToken);
    expect(
      parent.debug.explain({
        identifier: aliasRegistration.dependencies[0].identifier,
      }).landing,
    ).toMatchObject({ injector: parent });

    expect(child.debug.explain({ identifier: Injector }).landing).toMatchObject(
      { injector: child, synthetic: 'injector' },
    );
    expect(
      child.debug.explain({
        identifier: Injector,
        lookUp: LookUp.SKIP_SELF,
      }).landing,
    ).toMatchObject({ injector: parent, synthetic: 'injector' });
    expect(
      parent.debug.explain({
        identifier: Injector,
        lookUp: LookUp.SKIP_SELF,
        quantity: Quantity.OPTIONAL,
      }).outcome,
    ).toBe('optional-missing');
    expect(child.get(Injector, Quantity.MANY)).toEqual([child]);

    const normalInstance = child.debug.explain({ identifier: instanceToken });
    const newInstance = child.debug.explain({
      identifier: instanceToken,
      withNew: true,
    });
    expect(normalInstance.landing).toMatchObject({ injector: child });
    expect(newInstance.landing).toMatchObject({ injector: parent });
    expect(
      child.debug.explain({
        identifier: instanceToken,
        lookUp: LookUp.SELF,
        withNew: true,
      }).outcome,
    ).toBe('required-missing');

    expect(creations).toBe(0);
    expect(child.get(serviceToken).owner).toBe('child');
    expect(child.get(serviceToken, LookUp.SKIP_SELF).owner).toBe('parent');
    expect(child.get(manyToken, Quantity.MANY)).toEqual([1, 2]);
    expect(
      parent.debug
        .listRegistrations()
        .find((group) => group.identifier === manyToken)!
        .registrations.map((registration) => registration.status),
    ).toEqual(['created', 'created']);
    expect(child.get(optionalConsumer)).toBeNull();
    expect(child.get(manyConsumer)).toEqual([]);
    expect(() => child.get(withNewConsumer)).toThrow();
    expect(creations).toBe(1);
    parent.dispose();
  });

  it('explains multi-level alias chains without instantiating a lazy target', () => {
    let constructions = 0;

    class LazyTarget {
      readonly value = 'ready';

      constructor() {
        constructions += 1;
      }
    }

    const firstAlias = createIdentifier<LazyTarget>('debug-chain-first');
    const secondAlias = createIdentifier<LazyTarget>('debug-chain-second');
    const root = new Injector([
      [LazyTarget, { lazy: true, useClass: LazyTarget }],
      [firstAlias, { useExisting: LazyTarget }],
      [secondAlias, { useExisting: firstAlias }],
    ]);
    const middle = root.createChild();
    const leaf = middle.createChild();

    const rootGroups = root.debug.listRegistrations();
    const targetGroup = rootGroups.find(
      (group) => group.identifier === LazyTarget,
    )!;
    const firstAliasGroup = rootGroups.find(
      (group) => group.identifier === firstAlias,
    )!;
    const secondAliasGroup = rootGroups.find(
      (group) => group.identifier === secondAlias,
    )!;

    expect(
      leaf.debug.explain({ identifier: LazyTarget }).landing,
    ).toMatchObject({
      groupId: targetGroup.id,
      injector: root,
      registrationIds: [targetGroup.registrations[0].id],
    });
    expect(secondAliasGroup.registrations[0].dependencies[0].identifier).toBe(
      firstAlias,
    );
    expect(
      leaf.debug.explain({ identifier: firstAlias }).landing,
    ).toMatchObject({ groupId: firstAliasGroup.id, injector: root });
    expect(firstAliasGroup.registrations[0].dependencies[0].identifier).toBe(
      LazyTarget,
    );
    expect(
      leaf.debug.explain({ identifier: secondAlias }).landing,
    ).toMatchObject({ groupId: secondAliasGroup.id, injector: root });
    expect(constructions).toBe(0);
    expect(
      root.debug
        .listRegistrations()
        .flatMap((group) => group.registrations)
        .map((registration) => registration.status),
    ).toEqual(['not-created', 'not-created', 'not-created']);

    const resolved = leaf.get(secondAlias);
    expect(constructions).toBe(1);
    expect(resolved.value).toBe('ready');
    expect(constructions).toBe(1);
    expect(
      root.debug
        .listRegistrations()
        .flatMap((group) => group.registrations)
        .map((registration) => registration.status),
    ).toEqual(['created', 'created', 'created']);
    root.dispose();
  });

  it('lands on a direct instance without marking an earlier factory as created', () => {
    const token = createIdentifier<{ source: string }>(
      'debug-factory-before-instance',
    );
    const instance = { source: 'instance' };
    let factoryCalls = 0;
    const injector = new Injector([
      [
        token,
        {
          useFactory: () => {
            factoryCalls += 1;
            return { source: 'factory' };
          },
        },
      ],
    ]);
    injector.add([token, instance]);

    const group = injector.debug.listRegistrations()[0];
    expect(group.registrations).toHaveLength(2);
    expect(group.registrations[0]).toMatchObject({
      providerKind: 'factory',
      status: 'not-created',
    });
    expect(group.registrations[1]).toMatchObject({
      providerKind: 'instance',
      status: 'created',
    });
    expect(injector.debug.explain({ identifier: token }).landing).toMatchObject(
      {
        registrationIds: [group.registrations[1].id],
      },
    );
    expect(injector.get(token)).toBe(instance);
    expect(factoryCalls).toBe(0);
    injector.dispose();
  });

  it('deduplicates async loads and exposes the loaded provider dependencies', async () => {
    const dependencyToken = createIdentifier<number>('debug-async-dependency');
    const asyncToken = createIdentifier<number>('debug-async-provider');
    const ignoredToken = createIdentifier<number>('debug-async-ignored');
    let loaders = 0;
    let factories = 0;
    const injector = new Injector([
      [dependencyToken, { useValue: 2 }],
      [
        asyncToken,
        {
          useAsync: async () => {
            loaders += 1;
            await Promise.resolve();
            return [
              ignoredToken,
              {
                deps: [dependencyToken],
                useFactory: (value: number) => {
                  factories += 1;
                  return value * 3;
                },
              },
            ] as any;
          },
        },
      ],
    ]);

    const pending = injector.debug
      .listRegistrations()
      .find((group) => group.identifier === asyncToken)!
.registrations[0];
    expect(pending).toMatchObject({ dependencies: [], status: 'pending' });
    expect(injector.debug.explain({ identifier: asyncToken }).outcome).toBe(
      'resolved',
    );
    expect(loaders).toBe(0);

    const [first, second] = await Promise.all([
      injector.getAsync(asyncToken),
      injector.getAsync(asyncToken),
    ]);
    expect([first, second]).toEqual([6, 6]);
    expect(loaders).toBe(1);
    expect(factories).toBe(1);
    expect(await injector.getAsync(asyncToken)).toBe(6);

    const loaded = injector.debug
      .listRegistrations()
      .find((group) => group.identifier === asyncToken)!
.registrations[0];
    expect(loaded).toMatchObject({
      loadedProviderKind: 'factory',
      providerKind: 'async',
      status: 'created',
    });
    expect(loaded.dependencies[0]).toMatchObject({
      identifier: dependencyToken,
      identifierLabel: 'debug-async-dependency',
      quantity: Quantity.REQUIRED,
    });
    injector.dispose();
  });

  it('isolates concurrent async state when one item object is reused', async () => {
    const firstToken = createIdentifier<number>('debug-shared-async-first');
    const secondToken = createIdentifier<number>('debug-shared-async-second');
    let loaders = 0;
    const sharedItem = {
      useAsync: async () => {
        loaders += 1;
        await Promise.resolve();
        return 7;
      },
    };
    const injector = new Injector([
      [firstToken, sharedItem],
      [secondToken, sharedItem],
    ]);

    const before = injector.debug.listRegistrations();
    const firstRegistration = before.find(
      (group) => group.identifier === firstToken,
    )!.registrations[0];
    const secondRegistration = before.find(
      (group) => group.identifier === secondToken,
    )!.registrations[0];
    expect(firstRegistration.id).not.toBe(secondRegistration.id);

    expect(
      await Promise.all([
        injector.getAsync(firstToken),
        injector.getAsync(secondToken),
      ]),
    ).toEqual([7, 7]);
    expect(loaders).toBe(2);

    const after = injector.debug.listRegistrations();
    expect(
      after.find((group) => group.identifier === firstToken)!.registrations[0],
    ).toMatchObject({ loadedProviderKind: 'value', status: 'created' });
    expect(
      after.find((group) => group.identifier === secondToken)!.registrations[0],
    ).toMatchObject({ loadedProviderKind: 'value', status: 'created' });
    expect(
      injector.debug.explain({ identifier: firstToken }).landing,
    ).toMatchObject({ registrationIds: [firstRegistration.id] });
    expect(
      injector.debug.explain({ identifier: secondToken }).landing,
    ).toMatchObject({ registrationIds: [secondRegistration.id] });
    injector.dispose();
  });

  it('preserves modifier details in factory dependency snapshots', () => {
    const token = createIdentifier<unknown>('debug-modifier-target');
    const factory = createIdentifier<unknown>('debug-modifier-factory');
    const injector = new Injector([
      [
        factory,
        {
          deps: [
            [new SkipSelf(), new Optional(), token],
            [new Self(), new Many(), new WithNew(), token],
          ],
          useFactory: () => null,
        },
      ],
    ]);

    const dependencies =
      injector.debug.listRegistrations()[0].registrations[0].dependencies;
    expect(dependencies).toEqual([
      expect.objectContaining({
        lookUp: LookUp.SKIP_SELF,
        paramIndex: 0,
        quantity: Quantity.OPTIONAL,
        withNew: false,
      }),
      expect.objectContaining({
        lookUp: LookUp.SELF,
        paramIndex: 1,
        quantity: Quantity.MANY,
        withNew: true,
      }),
    ]);
    injector.dispose();
  });
});
