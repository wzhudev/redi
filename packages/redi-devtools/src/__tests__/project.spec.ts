import {
  createIdentifier,
  getInjectorDiscoverySnapshot,
  ignoreInjectorForDiscovery,
  Injector,
  Many,
  Optional,
  registerInjectorForDiscovery,
  Self,
  setInjectorDiscoveryMetadata,
  SkipSelf,
  WithNew,
} from '@wendellhu/redi';
import { describe, expect, test } from 'bun:test';
import { filterGraphByRoot, projectDependencyGraph } from '../graph/project';

describe('projectDependencyGraph', () => {
  test('projects a forest, resolution outcomes and async loading without observation side effects', async () => {
    const target = createIdentifier<number>('project-target');
    const missing = createIdentifier<number>('project-missing');
    const crossConsumer = createIdentifier<unknown>('project-cross-consumer');
    const requiredConsumer = createIdentifier<unknown>(
      'project-required-consumer',
    );
    const asyncToken = createIdentifier<number>('project-async');
    const injectorConsumer = createIdentifier<unknown>(
      'project-injector-consumer',
    );
    let factoryCalls = 0;
    let asyncFactoryCalls = 0;

    const parent = new Injector([[target, { useValue: 7 }]]);
    const child = new Injector(
      [
        [
          crossConsumer,
          {
            deps: [
              [new SkipSelf(), target],
              [new Optional(), new Self(), missing],
              [new Many(), missing],
              [new WithNew(), target],
            ],
            useFactory: (...values: unknown[]) => {
              factoryCalls += 1;
              return values;
            },
          },
        ],
        [
          requiredConsumer,
          {
            deps: [missing],
            useFactory: (value: unknown) => value,
          },
        ],
        [
          injectorConsumer,
          {
            deps: [Injector],
            useFactory: (value: unknown) => value,
          },
        ],
        [
          asyncToken,
          {
            useAsync: async () => [
              asyncToken,
              {
                deps: [[new SkipSelf(), target]],
                useFactory: (value: number) => {
                  asyncFactoryCalls += 1;
                  return value;
                },
              },
            ],
          },
        ],
      ],
      parent,
    );
    const secondRoot = new Injector();
    setInjectorDiscoveryMetadata(child, {
      react: {
        componentName: 'ProjectProvider',
        source: 'react',
      },
    });

    try {
      const snapshot = getInjectorDiscoverySnapshot();
      const model = projectDependencyGraph({ snapshot });
      const parentCluster = model.clusters.find(
        (cluster) => cluster.injector === parent,
      )!;
      const childCluster = model.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      const secondRootCluster = model.clusters.find(
        (cluster) => cluster.injector === secondRoot,
      )!;

      expect(model.rootIds).toContain(parentCluster.id);
      expect(model.rootIds).toContain(secondRootCluster.id);
      expect(childCluster.parentId).toBe(parentCluster.id);
      expect(parentCluster.childIds).toContain(childCluster.id);
      expect(childCluster.metadata).toMatchObject({
        react: {
          componentName: 'ProjectProvider',
          source: 'react',
        },
      });

      const outcomes = model.edges.map((edge) => edge.outcome);
      expect(outcomes).toContain('resolved');
      expect(outcomes).toContain('optional-missing');
      expect(outcomes).toContain('many-empty');
      expect(outcomes).toContain('required-missing');
      expect(outcomes).toContain('injector');

      const crossEdge = model.edges.find((edge) =>
        edge.label.includes('project-target'),
      )!;
      expect(crossEdge.sourceClusterId).toBe(childCluster.id);
      expect(crossEdge.targetClusterId).toBe(parentCluster.id);
      expect(crossEdge.targetGroupId).not.toBeNull();

      const asyncRegistration = childCluster.groups.find(
        (group) => group.identifierLabel === 'project-async',
      )!.registrations[0];
      expect(asyncRegistration.status).toBe('pending');
      expect(asyncRegistration.dependencies).toEqual([]);
      expect(
        model.edges.some(
          (edge) => edge.sourceRegistrationId === asyncRegistration.id,
        ),
      ).toBe(false);
      expect(factoryCalls).toBe(0);
      expect(asyncFactoryCalls).toBe(0);

      const focused = filterGraphByRoot(model, parentCluster.id);
      expect(focused.clusters.map((cluster) => cluster.id)).toEqual([
        parentCluster.id,
        childCluster.id,
      ]);
      expect(focused.rootIds).toEqual([parentCluster.id]);

      await child.getAsync(asyncToken);
      const loadedModel = projectDependencyGraph();
      const loadedChild = loadedModel.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      const loadedAsyncRegistration = loadedChild.groups.find(
        (group) => group.identifierLabel === 'project-async',
      )!.registrations[0];
      expect(loadedAsyncRegistration).toMatchObject({
        loadedProviderKind: 'factory',
        providerKind: 'async',
        status: 'created',
      });
      expect(loadedAsyncRegistration.dependencies).toHaveLength(1);
      expect(
        loadedModel.edges.find(
          (edge) =>
            edge.sourceRegistrationId === loadedAsyncRegistration.id,
        ),
      ).toMatchObject({
        outcome: 'resolved',
        targetClusterId: parentCluster.id,
      });
      expect(asyncFactoryCalls).toBe(1);
    } finally {
      parent.dispose();
      secondRoot.dispose();
    }
  });

  test('keeps filtered registration dependencies aligned with cross-tree edges', () => {
    const target = createIdentifier<number>('project-filter-target');
    const consumer = createIdentifier<number>('project-filter-consumer');
    const parent = new Injector([[target, { useValue: 1 }]]);
    const child = parent.createChild([
      [
        consumer,
        {
          deps: [[new SkipSelf(), target]],
          useFactory: (value: number) => value,
        },
      ],
    ]);

    try {
      registerInjectorForDiscovery(child, null);
      const model = projectDependencyGraph();
      const childCluster = model.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      const edge = model.edges.find(
        (candidate) => candidate.sourceClusterId === childCluster.id,
      )!;
      expect(edge.outcome).toBe('resolved');

      const focused = filterGraphByRoot(model, childCluster.id);
      expect(focused.edges[0]).toMatchObject({
        outcome: 'external',
        targetClusterId: null,
        targetGroupId: null,
        targetRegistrationIds: [],
      });
      expect(
        focused.clusters[0].groups[0].registrations[0].dependencies[0],
      ).toMatchObject({
        outcome: 'external',
        targetClusterId: null,
        targetGroupId: null,
        targetRegistrationIds: [],
      });

      ignoreInjectorForDiscovery(parent);
      const externalAtProjection = projectDependencyGraph();
      const externalChild = externalAtProjection.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      expect(
        externalAtProjection.edges.find(
          (candidate) => candidate.sourceClusterId === externalChild.id,
        )?.outcome,
      ).toBe('external');

      const childRecord = getInjectorDiscoverySnapshot().records.find(
        (record) => record.injector === child,
      )!;
      const recovered = projectDependencyGraph({
        snapshot: { records: [childRecord], roots: [] },
      });
      expect(recovered.rootIds).toEqual([childCluster.id]);
      expect(filterGraphByRoot(recovered, null)).toBe(recovered);
    } finally {
      parent.dispose();
    }
  });
});
