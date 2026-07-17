import {
  createIdentifier,
  Injector,
  Optional,
  setInjectorDiscoveryMetadata,
  SkipSelf,
} from '@wendellhu/redi';
import { describe, expect, test } from 'bun:test';
import { projectDependencyGraph } from '../graph/project';
import {
  buildCanvasGraph,
  dependencyHandles,
  highlightedRelationships,
  indexCanvasNodeKinds,
  layoutCanvasGraph,
} from '../ui/graphCanvasModel';

function absoluteY(
  layout: Awaited<ReturnType<typeof layoutCanvasGraph>>,
  id: string,
): number {
  let geometry = layout.byId.get(id);
  let y = 0;
  while (geometry) {
    y += geometry.y;
    geometry = geometry.parentId
      ? layout.byId.get(geometry.parentId)
      : undefined;
  }
  return y;
}

describe('graph canvas model', () => {
  test('builds independent Injector compounds with concrete Registration edges', async () => {
    const target = createIdentifier<number>('canvas-target');
    const alias = createIdentifier<number>('canvas-alias');
    const consumer = createIdentifier<number>('canvas-consumer');
    const root = new Injector([
      [target, { useValue: 1 }],
      [alias, { useExisting: target }],
    ]);
    const child = root.createChild([
      [
        consumer,
        {
          deps: [[new SkipSelf(), target]],
          useFactory: (value: number) => value,
        },
      ],
    ]);
    setInjectorDiscoveryMetadata(root, { label: 'Canvas root' });
    setInjectorDiscoveryMetadata(child, { label: 'Canvas child' });

    try {
      const model = projectDependencyGraph();
      const rootCluster = model.clusters.find(
        (cluster) => cluster.injector === root,
      )!;
      const childCluster = model.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      const targetRegistration = rootCluster.groups[0].registrations[0];
      const consumerRegistration = childCluster.groups[0].registrations[0];
      const aliasRegistration = rootCluster.groups.find(
        (group) => group.identifierLabel === 'canvas-alias',
      )!.registrations[0];
      const graph = buildCanvasGraph(model, {
        collapsedContents: new Set(),
        collapsedSubtrees: new Set(),
        rootId: rootCluster.id,
      });

      expect(graph.nodes.find((node) => node.id === rootCluster.id)?.parentId).toBeUndefined();
      expect(graph.nodes.find((node) => node.id === childCluster.id)?.parentId).toBeUndefined();
      expect(
        graph.nodes.find((node) => node.id === targetRegistration.groupId)
          ?.parentId,
      ).toBe(rootCluster.id);
      expect(
        graph.nodes.find((node) => node.id === targetRegistration.id)?.parentId,
      ).toBe(targetRegistration.groupId);
      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          kind: 'structural',
          source: rootCluster.id,
          target: childCluster.id,
        }),
      );
      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          aggregated: false,
          kind: 'dependency',
          source: consumerRegistration.id,
          target: targetRegistration.id,
        }),
      );
      const dependencyEdge = graph.edges.find(
        (edge) => edge.kind === 'dependency',
      )!;
      expect(dependencyEdge.label).toBe('SkipSelf');
      const aliasEdge = graph.edges.find((edge) => edge.kind === 'alias')!;
      expect(aliasEdge).toEqual(
        expect.objectContaining({
          kind: 'alias',
          source: aliasRegistration.id,
          target: targetRegistration.id,
        }),
      );
      expect(aliasEdge.label).toBeUndefined();
      expect(consumerRegistration.id.startsWith('injector-')).toBe(true);
      expect(
        dependencyHandles(indexCanvasNodeKinds(graph.nodes), dependencyEdge),
      ).toEqual({});

      const layout = await layoutCanvasGraph(graph);
      expect(layout.byId.get(rootCluster.id)?.parentId).toBeUndefined();
      expect(layout.byId.get(childCluster.id)?.parentId).toBeUndefined();
      expect(layout.byId.get(targetRegistration.groupId)?.parentId).toBe(
        rootCluster.id,
      );
      expect(layout.byId.get(targetRegistration.id)?.parentId).toBe(
        targetRegistration.groupId,
      );
      expect(layout.byId.get(childCluster.id)!.y).toBeGreaterThan(
        layout.byId.get(rootCluster.id)!.y,
      );
    } finally {
      root.dispose();
    }
  });

  test('orders dependencies above consumers, aggregates boundaries, and computes highlighting', async () => {
    const target = createIdentifier<number>('aggregate-target');
    const consumer = createIdentifier<number>('aggregate-consumer');
    const downstream = createIdentifier<number>('aggregate-downstream');
    const root = new Injector([[target, { useValue: 1 }]]);
    const child = root.createChild([
      [
        consumer,
        {
          deps: [[new SkipSelf(), target]],
          useFactory: (value: number) => value,
        },
      ],
      [
        downstream,
        {
          deps: [consumer],
          useFactory: (value: number) => value,
        },
      ],
    ]);

    try {
      const model = projectDependencyGraph();
      const rootCluster = model.clusters.find(
        (cluster) => cluster.injector === root,
      )!;
      const childCluster = model.clusters.find(
        (cluster) => cluster.injector === child,
      )!;
      const targetRegistration = rootCluster.groups[0].registrations[0];
      const consumerRegistration = childCluster.groups.find(
        (group) => group.identifierLabel === 'aggregate-consumer',
      )!.registrations[0];
      const downstreamRegistration = childCluster.groups.find(
        (group) => group.identifierLabel === 'aggregate-downstream',
      )!.registrations[0];

      const expanded = buildCanvasGraph(model, {
        collapsedContents: new Set(),
        collapsedSubtrees: new Set(),
        rootId: rootCluster.id,
      });
      const expandedLayout = await layoutCanvasGraph(expanded);
      expect(absoluteY(expandedLayout, consumerRegistration.id)).toBeLessThan(
        absoluteY(expandedLayout, downstreamRegistration.id),
      );

      const collapsed = buildCanvasGraph(model, {
        collapsedContents: new Set([childCluster.id]),
        collapsedSubtrees: new Set(),
        rootId: rootCluster.id,
      });
      expect(
        collapsed.nodes.some(
          (node) => node.id === consumerRegistration.id,
        ),
      ).toBe(false);
      expect(collapsed.edges).toContainEqual(
        expect.objectContaining({
          aggregated: true,
          source: childCluster.id,
          target: targetRegistration.id,
        }),
      );
      const aggregateEdge = collapsed.edges.find(
        (edge) => edge.kind === 'dependency' && edge.aggregated,
      )!;
      expect(
        dependencyHandles(
          indexCanvasNodeKinds(collapsed.nodes),
          aggregateEdge,
        ),
      ).toEqual({ sourceHandle: 'dependency-source' });

      const collapsedSubtree = buildCanvasGraph(model, {
        collapsedContents: new Set(),
        collapsedSubtrees: new Set([rootCluster.id]),
        rootId: rootCluster.id,
      });
      expect(
        collapsedSubtree.nodes.some((node) => node.id === childCluster.id),
      ).toBe(false);
      expect(collapsedSubtree.edges).toContainEqual(
        expect.objectContaining({
          aggregated: true,
          source: rootCluster.id,
          target: targetRegistration.id,
        }),
      );

      const highlighted = highlightedRelationships(
        model,
        consumerRegistration.id,
      );
      expect(highlighted.registrationIds).toEqual(
        new Set([
          consumerRegistration.id,
          targetRegistration.id,
          downstreamRegistration.id,
        ]),
      );
      expect(highlighted.edgeIds.size).toBe(2);
    } finally {
      root.dispose();
    }
  });

  test('represents missing outcomes as terminal edges, not registrations', () => {
    const missing = createIdentifier<number>('missing-terminal-target');
    const consumer = createIdentifier<number>('missing-terminal-consumer');
    const root = new Injector([
      [
        consumer,
        {
          deps: [[new Optional(), missing]],
          useFactory: (value: number | null) => value ?? 0,
        },
      ],
    ]);

    try {
      const model = projectDependencyGraph();
      const cluster = model.clusters.find(
        (candidate) => candidate.injector === root,
      )!;
      const graph = buildCanvasGraph(model, {
        collapsedContents: new Set(),
        collapsedSubtrees: new Set(),
        rootId: cluster.id,
      });
      const edge = graph.edges.find(
        (candidate) => candidate.kind === 'dependency',
      )!;

      expect(edge.label).toBeUndefined();
      expect(graph.nodes.find((node) => node.id === edge.target)?.kind).toBe(
        'terminal',
      );
      expect(
        graph.nodes.some(
          (node) => node.kind === 'registration' && node.id === edge.target,
        ),
      ).toBe(false);
    } finally {
      root.dispose();
    }
  });
});
