import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type {
  GraphCluster,
  GraphEdge,
  GraphGroup,
  GraphModel,
  GraphRegistration,
} from '../graph/model';
import { LookUp } from '@wendellhu/redi';
import ELK from 'elkjs/lib/elk-api.js';
import { Worker as ElkWorker } from 'elkjs/lib/elk-worker.min.js';

export type CanvasEntityKind =
  | 'group'
  | 'injector'
  | 'registration'
  | 'terminal';

export interface CanvasNodeModel {
  readonly clusterId: string;
  readonly height: number;
  readonly id: string;
  readonly kind: CanvasEntityKind;
  readonly parentId?: string;
  readonly source?: GraphCluster | GraphGroup | GraphRegistration;
  readonly terminalLabel?: string;
  readonly terminalOutcome?: GraphEdge['outcome'];
  readonly width: number;
}

export type CanvasEdgeKind = 'alias' | 'dependency' | 'structural';

export interface CanvasEdgeModel {
  readonly aggregated: boolean;
  readonly count: number;
  readonly hoverLabel?: string;
  readonly id: string;
  readonly kind: CanvasEdgeKind;
  readonly label?: string;
  readonly originalEdgeIds: readonly string[];
  readonly outcome?: GraphEdge['outcome'];
  readonly source: string;
  readonly target: string;
}

export interface CanvasDependencyHandles {
  readonly sourceHandle?: 'dependency-source';
  readonly targetHandle?: 'dependency-target';
}

export interface CanvasGraphModel {
  readonly edges: readonly CanvasEdgeModel[];
  readonly nodes: readonly CanvasNodeModel[];
  readonly structureKey: string;
}

export interface CanvasGraphOptions {
  readonly collapsedContents: ReadonlySet<string>;
  readonly collapsedSubtrees: ReadonlySet<string>;
  readonly rootId: string;
}

export interface CanvasGeometry {
  readonly height: number;
  readonly id: string;
  readonly parentId?: string;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface CanvasLayout {
  readonly byId: ReadonlyMap<string, CanvasGeometry>;
  readonly structureKey: string;
}

export interface GraphIndex {
  readonly clusterById: ReadonlyMap<string, GraphCluster>;
  readonly clusterByRegistrationId: ReadonlyMap<string, GraphCluster>;
  readonly groupById: ReadonlyMap<
    string,
    Readonly<{ cluster: GraphCluster; group: GraphGroup }>
  >;
  readonly incomingByRegistrationId: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly outgoingByRegistrationId: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly registrationById: ReadonlyMap<string, GraphRegistration>;
}

const INJECTOR_MIN_WIDTH = 300;
const INJECTOR_COLLAPSED_HEIGHT = 78;
const GROUP_MIN_WIDTH = 236;
const REGISTRATION_WIDTH = GROUP_MIN_WIDTH;
const REGISTRATION_HEIGHT = 62;
const TERMINAL_WIDTH = 160;
const TERMINAL_HEIGHT = 30;

const elk = new ELK({
  workerFactory: () => new ElkWorker() as unknown as Worker,
});

const outcomeLabels: Record<GraphEdge['outcome'], string> = {
  external: 'Outside active tree',
  injector: 'Injector itself',
  'many-empty': 'Many: empty',
  'optional-missing': 'Optional: missing',
  'quantity-mismatch': 'Quantity mismatch',
  'required-missing': 'Required: missing',
  resolved: 'Resolved',
};

export function createGraphIndex(model: GraphModel): GraphIndex {
  const clusterById = new Map<string, GraphCluster>();
  const clusterByRegistrationId = new Map<string, GraphCluster>();
  const groupById = new Map<
    string,
    Readonly<{ cluster: GraphCluster; group: GraphGroup }>
  >();
  const incomingByRegistrationId = new Map<string, GraphEdge[]>();
  const outgoingByRegistrationId = new Map<string, GraphEdge[]>();
  const registrationById = new Map<string, GraphRegistration>();

  for (const cluster of model.clusters) {
    clusterById.set(cluster.id, cluster);
    for (const group of cluster.groups) {
      groupById.set(group.id, { cluster, group });
      for (const registration of group.registrations) {
        registrationById.set(registration.id, registration);
        clusterByRegistrationId.set(registration.id, cluster);
      }
    }
  }

  for (const edge of model.edges) {
    const outgoing = outgoingByRegistrationId.get(edge.sourceRegistrationId);
    if (outgoing) outgoing.push(edge);
    else outgoingByRegistrationId.set(edge.sourceRegistrationId, [edge]);

    for (const targetId of edge.targetRegistrationIds) {
      const incoming = incomingByRegistrationId.get(targetId);
      if (incoming) incoming.push(edge);
      else incomingByRegistrationId.set(targetId, [edge]);
    }
  }

  return {
    clusterById,
    clusterByRegistrationId,
    groupById,
    incomingByRegistrationId,
    outgoingByRegistrationId,
    registrationById,
  };
}

function collectTreeClusterIds(
  index: GraphIndex,
  rootId: string,
): readonly string[] {
  const ids: string[] = [];
  const visit = (id: string): void => {
    const cluster = index.clusterById.get(id);
    if (!cluster) return;
    ids.push(id);
    cluster.childIds.forEach(visit);
  };
  visit(rootId);
  return ids;
}

function visibleTree(
  index: GraphIndex,
  rootId: string,
  collapsedSubtrees: ReadonlySet<string>,
): Readonly<{
  boundaryByClusterId: ReadonlyMap<string, string>;
  clusterIds: readonly string[];
}> {
  const boundaryByClusterId = new Map<string, string>();
  const clusterIds: string[] = [];

  const visit = (id: string, collapsedBoundary: string | null): void => {
    const cluster = index.clusterById.get(id);
    if (!cluster) return;
    if (collapsedBoundary) {
      boundaryByClusterId.set(id, collapsedBoundary);
      cluster.childIds.forEach((childId) => visit(childId, collapsedBoundary));
      return;
    }

    clusterIds.push(id);
    boundaryByClusterId.set(id, id);
    const nextBoundary = collapsedSubtrees.has(id) ? id : null;
    cluster.childIds.forEach((childId) => visit(childId, nextBoundary));
  };

  visit(rootId, null);
  return { boundaryByClusterId, clusterIds };
}

function terminalId(edge: GraphEdge): string {
  return `${edge.id}/terminal`;
}

function edgeTargets(edge: GraphEdge): readonly string[] {
  if (edge.targetRegistrationIds.length > 0) {
    return edge.targetRegistrationIds;
  }
  if (edge.outcome === 'injector' && edge.targetClusterId) {
    return [edge.targetClusterId];
  }
  return [terminalId(edge)];
}

interface Endpoint {
  readonly hidden: boolean;
  readonly id: string;
}

function registrationEndpoint(
  registrationId: string,
  index: GraphIndex,
  visibleClusterIds: ReadonlySet<string>,
  boundaryByClusterId: ReadonlyMap<string, string>,
  collapsedContents: ReadonlySet<string>,
): Endpoint | null {
  const cluster = index.clusterByRegistrationId.get(registrationId);
  if (!cluster) return null;
  const boundary = boundaryByClusterId.get(cluster.id);
  if (!boundary) return null;
  if (!visibleClusterIds.has(cluster.id) || collapsedContents.has(cluster.id)) {
    return { hidden: true, id: boundary };
  }
  return { hidden: false, id: registrationId };
}

interface MutableAggregate {
  count: number;
  id: string;
  kind: Exclude<CanvasEdgeKind, 'structural'>;
  originalEdgeIds: Set<string>;
  outcome?: GraphEdge['outcome'];
  source: string;
  target: string;
}

function lookupBadge(edge: GraphEdge): string | undefined {
  if (edge.lookUp === LookUp.SELF) return 'Self';
  if (edge.lookUp === LookUp.SKIP_SELF) return 'SkipSelf';
  return undefined;
}

export function buildCanvasGraph(
  model: GraphModel,
  options: CanvasGraphOptions,
): CanvasGraphModel {
  const index = createGraphIndex(model);
  const treeIds = new Set(collectTreeClusterIds(index, options.rootId));
  const { boundaryByClusterId, clusterIds } = visibleTree(
    index,
    options.rootId,
    options.collapsedSubtrees,
  );
  const visibleClusterIds = new Set(clusterIds);
  const nodes: CanvasNodeModel[] = [];
  const edges: CanvasEdgeModel[] = [];

  for (const clusterId of clusterIds) {
    const cluster = index.clusterById.get(clusterId)!;
    nodes.push({
      clusterId,
      height: INJECTOR_COLLAPSED_HEIGHT,
      id: cluster.id,
      kind: 'injector',
      source: cluster,
      width: INJECTOR_MIN_WIDTH,
    });

    if (!options.collapsedContents.has(clusterId)) {
      for (const group of cluster.groups) {
        nodes.push({
          clusterId,
          height: 54,
          id: group.id,
          kind: 'group',
          parentId: clusterId,
          source: group,
          width: GROUP_MIN_WIDTH,
        });
        for (const registration of group.registrations) {
          nodes.push({
            clusterId,
            height: REGISTRATION_HEIGHT,
            id: registration.id,
            kind: 'registration',
            parentId: group.id,
            source: registration,
            width: REGISTRATION_WIDTH,
          });
        }
      }
    }

    if (cluster.parentId && visibleClusterIds.has(cluster.parentId)) {
      edges.push({
        aggregated: false,
        count: 1,
        id: `structure/${cluster.parentId}/${cluster.id}`,
        kind: 'structural',
        originalEdgeIds: [],
        source: cluster.parentId,
        target: cluster.id,
      });
    }
  }

  const aggregates = new Map<string, MutableAggregate>();
  for (const edge of model.edges) {
    if (!treeIds.has(edge.sourceClusterId)) continue;
    const source = registrationEndpoint(
      edge.sourceRegistrationId,
      index,
      visibleClusterIds,
      boundaryByClusterId,
      options.collapsedContents,
    );
    if (!source) continue;
    const kind =
      index.registrationById.get(edge.sourceRegistrationId)?.providerKind ===
      'existing'
        ? 'alias'
        : 'dependency';

    for (const [targetIndex, rawTargetId] of edgeTargets(edge).entries()) {
      let target: Endpoint | null;
      if (rawTargetId === terminalId(edge)) {
        if (source.hidden) continue;
        target = { hidden: false, id: rawTargetId };
        if (!nodes.some((node) => node.id === rawTargetId)) {
          nodes.push({
            clusterId: edge.sourceClusterId,
            height: TERMINAL_HEIGHT,
            id: rawTargetId,
            kind: 'terminal',
            parentId: edge.sourceClusterId,
            terminalLabel: outcomeLabels[edge.outcome],
            terminalOutcome: edge.outcome,
            width: TERMINAL_WIDTH,
          });
        }
      } else if (index.registrationById.has(rawTargetId)) {
        target = registrationEndpoint(
          rawTargetId,
          index,
          visibleClusterIds,
          boundaryByClusterId,
          options.collapsedContents,
        );
      } else {
        const boundary = boundaryByClusterId.get(rawTargetId);
        target = boundary ? { hidden: false, id: boundary } : null;
      }
      if (!target || source.id === target.id) continue;

      if (source.hidden || target.hidden) {
        const key = `${kind}/${source.id}/${target.id}`;
        const aggregate = aggregates.get(key) ?? {
          count: 0,
          id: `aggregate/${key}`,
          kind,
          originalEdgeIds: new Set<string>(),
          source: source.id,
          target: target.id,
        };
        aggregate.count += 1;
        aggregate.originalEdgeIds.add(edge.id);
        aggregates.set(key, aggregate);
        continue;
      }

      edges.push({
        aggregated: false,
        count: 1,
        hoverLabel: edge.label,
        id: `${edge.id}/target-${targetIndex}`,
        kind,
        ...(lookupBadge(edge) ? { label: lookupBadge(edge) } : {}),
        originalEdgeIds: [edge.id],
        outcome: edge.outcome,
        source: source.id,
        target: target.id,
      });
    }
  }

  for (const aggregate of aggregates.values()) {
    edges.push({
      aggregated: true,
      count: aggregate.count,
      id: aggregate.id,
      kind: aggregate.kind,
      originalEdgeIds: [...aggregate.originalEdgeIds],
      source: aggregate.source,
      target: aggregate.target,
    });
  }

  const structureKey = [
    ...nodes.map((node) => `${node.kind}:${node.id}:${node.parentId ?? ''}`),
    ...edges.map((edge) => `${edge.kind}:${edge.source}:${edge.target}`),
  ].join('|');

  return { edges, nodes, structureKey };
}

/** Map collapsed Injector-boundary edges to the Injector-only handles. */
export function indexCanvasNodeKinds(
  nodes: readonly CanvasNodeModel[],
): ReadonlyMap<string, CanvasEntityKind> {
  return new Map(nodes.map((node) => [node.id, node.kind]));
}

export function dependencyHandles(
  kindById: ReadonlyMap<string, CanvasEntityKind>,
  edge: CanvasEdgeModel,
): CanvasDependencyHandles {
  return {
    ...(kindById.get(edge.source) === 'injector'
      ? { sourceHandle: 'dependency-source' as const }
      : {}),
    ...(kindById.get(edge.target) === 'injector'
      ? { targetHandle: 'dependency-target' as const }
      : {}),
  };
}

function elkEdge(edge: CanvasEdgeModel): ElkExtendedEdge {
  return {
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  };
}

function geometryFromElk(
  node: ElkNode,
  parentId: string | undefined,
  geometries: Map<string, CanvasGeometry>,
): void {
  if (node.id !== 'layout-root' && node.id !== 'injector-inner-root') {
    geometries.set(node.id, {
      height: node.height ?? 0,
      id: node.id,
      ...(parentId ? { parentId } : {}),
      width: node.width ?? 0,
      x: node.x ?? 0,
      y: node.y ?? 0,
    });
  }
  for (const child of node.children ?? []) {
    geometryFromElk(
      child,
      node.id === 'layout-root' || node.id === 'injector-inner-root'
        ? parentId
        : node.id,
      geometries,
    );
  }
}

function innerElkNode(
  injector: CanvasNodeModel,
  nodes: readonly CanvasNodeModel[],
  edges: readonly CanvasEdgeModel[],
): ElkNode {
  const groups = nodes.filter(
    (node) => node.kind === 'group' && node.parentId === injector.id,
  );
  const terminals = nodes.filter(
    (node) => node.kind === 'terminal' && node.parentId === injector.id,
  );
  const childNodes: ElkNode[] = groups.map((group) => {
    const registrations = nodes.filter(
      (node) => node.kind === 'registration' && node.parentId === group.id,
    );
    return {
      id: group.id,
      children: registrations.map((registration) => ({
        height: registration.height,
        id: registration.id,
        width: registration.width,
      })),
      edges: registrations.slice(1).map((registration, index) => ({
        id: `stack/${group.id}/${index}`,
        sources: [registrations[index]!.id],
        targets: [registration.id],
      })),
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.layered.spacing.nodeNodeBetweenLayers': '0',
        'elk.padding': '[top=32,left=0,bottom=0,right=0]',
        'elk.spacing.nodeNode': '0',
      },
    };
  });
  childNodes.push(
    ...terminals.map((terminal) => ({
      height: terminal.height,
      id: terminal.id,
      width: terminal.width,
    })),
  );
  const nodeIds = new Set<string>([
    ...childNodes.flatMap((node) => [
      node.id,
      ...(node.children?.map((child) => child.id) ?? []),
    ]),
  ]);
  const nodeKinds = indexCanvasNodeKinds(nodes);
  const innerEdges = edges
    .filter(
      (edge) =>
        edge.kind !== 'structural' &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target),
    )
    .map((edge): ElkExtendedEdge => {
      // Runtime edges point consumer -> dependency. Reverse only the ELK
      // ordering constraint so dependencies are placed above their consumers;
      // the rendered edge and arrow direction remain unchanged.
      if (nodeKinds.get(edge.target) === 'registration') {
        return {
          id: edge.id,
          sources: [edge.target],
          targets: [edge.source],
        };
      }
      return elkEdge(edge);
    });

  return {
    id: 'injector-inner-root',
    children: childNodes,
    edges: innerEdges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.padding': '[top=72,left=18,bottom=18,right=18]',
      'elk.spacing.nodeNode': '22',
      'elk.layered.spacing.nodeNodeBetweenLayers': '34',
    },
  };
}

export async function layoutCanvasGraph(
  graph: CanvasGraphModel,
): Promise<CanvasLayout> {
  const geometries = new Map<string, CanvasGeometry>();
  const injectors = graph.nodes.filter((node) => node.kind === 'injector');
  const laidOutInjectors = await Promise.all(
    injectors.map(async (injector) => {
      const innerNodes = graph.nodes.filter(
        (node) => node.clusterId === injector.id && node.id !== injector.id,
      );
      if (innerNodes.length === 0) {
        return {
          geometry: new Map<string, CanvasGeometry>(),
          height: INJECTOR_COLLAPSED_HEIGHT,
          id: injector.id,
          width: INJECTOR_MIN_WIDTH,
        };
      }
      const inner = await elk.layout(
        innerElkNode(injector, graph.nodes, graph.edges),
      );
      const innerGeometry = new Map<string, CanvasGeometry>();
      geometryFromElk(inner, injector.id, innerGeometry);
      return {
        geometry: innerGeometry,
        height: Math.max(inner.height ?? 0, INJECTOR_COLLAPSED_HEIGHT),
        id: injector.id,
        width: Math.max(inner.width ?? 0, INJECTOR_MIN_WIDTH),
      };
    }),
  );

  const outer: ElkNode = {
    id: 'layout-root',
    children: laidOutInjectors.map((injector) => ({
      height: injector.height,
      id: injector.id,
      width: injector.width,
    })),
    edges: graph.edges
      .filter((edge) => edge.kind === 'structural')
      .map(elkEdge),
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.padding': '[top=36,left=36,bottom=36,right=36]',
      'elk.spacing.nodeNode': '56',
    },
  };
  const laidOutOuter = await elk.layout(outer);
  geometryFromElk(laidOutOuter, undefined, geometries);

  for (const injector of laidOutInjectors) {
    for (const geometry of injector.geometry.values()) {
      geometries.set(geometry.id, geometry);
    }
  }

  return { byId: geometries, structureKey: graph.structureKey };
}

export function highlightedRelationships(
  model: GraphModel,
  selectedRegistrationId: string | null,
): Readonly<{
  edgeIds: ReadonlySet<string>;
  registrationIds: ReadonlySet<string>;
}> {
  if (!selectedRegistrationId) {
    return { edgeIds: new Set(), registrationIds: new Set() };
  }
  const index = createGraphIndex(model);
  const edgeIds = new Set<string>();
  const registrationIds = new Set<string>([selectedRegistrationId]);
  const pending = [selectedRegistrationId];

  while (pending.length > 0) {
    const sourceId = pending.pop()!;
    for (const edge of index.outgoingByRegistrationId.get(sourceId) ?? []) {
      if (edgeIds.has(edge.id)) continue;
      edgeIds.add(edge.id);
      for (const targetId of edge.targetRegistrationIds) {
        if (!registrationIds.has(targetId)) {
          registrationIds.add(targetId);
          pending.push(targetId);
        }
      }
    }
  }

  for (const edge of index.incomingByRegistrationId.get(
    selectedRegistrationId,
  ) ?? []) {
    edgeIds.add(edge.id);
    registrationIds.add(edge.sourceRegistrationId);
  }

  return { edgeIds, registrationIds };
}

export function rootTreeIds(
  model: GraphModel,
  rootId: string,
): ReadonlySet<string> {
  return new Set(collectTreeClusterIds(createGraphIndex(model), rootId));
}
