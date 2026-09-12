import type {
  Injector,
  InjectorDebugDependencyDescriptor,
  InjectorDebugIdentifierGroup,
  InjectorDiscoveryRecord,
  InjectorDiscoverySnapshot,
} from '@wendellhu/redi';
import type {
  GraphCluster,
  GraphDependency,
  GraphEdge,
  GraphEdgeOutcome,
  GraphGroup,
  GraphModel,
  GraphRegistration,
} from './model';
import {
  getInjectorDiscoverySnapshot,
  LookUp,
  Quantity,
} from '@wendellhu/redi';

export interface ProjectDependencyGraphOptions {
  /** Fixed input for deterministic callers and tests. Defaults to Discovery. */
  readonly snapshot?: InjectorDiscoverySnapshot;
}

function clusterId(record: InjectorDiscoveryRecord): string {
  return `injector-${record.id}`;
}

function groupId(cluster: string, debugId: string): string {
  return `${cluster}/${debugId}`;
}

function registrationId(group: string, debugId: string): string {
  return `${group}/${debugId}`;
}

function metadataLabel(record: InjectorDiscoveryRecord): string | undefined {
  const label = record.metadata?.label;
  return typeof label === 'string' && label.length > 0 ? label : undefined;
}

function decorateDependency(
  dependency: InjectorDebugDependencyDescriptor,
): string {
  const modifiers: string[] = [];
  if (dependency.quantity === Quantity.MANY) modifiers.push('@Many');
  if (dependency.quantity === Quantity.OPTIONAL) modifiers.push('@Optional');
  if (dependency.lookUp === LookUp.SELF) modifiers.push('@Self');
  if (dependency.lookUp === LookUp.SKIP_SELF) modifiers.push('@SkipSelf');
  if (dependency.withNew) modifiers.push('@WithNew');
  modifiers.push(dependency.identifierLabel);
  return modifiers.join(' ');
}

/**
 * Build the complete Dependency Graph as a read-only projection. It only
 * reads Discovery, registration snapshots and Resolution Explain; it never
 * calls `get()` or otherwise creates a dependency.
 */
export function projectDependencyGraph(
  options: ProjectDependencyGraphOptions = {},
): GraphModel {
  const snapshot = options.snapshot ?? getInjectorDiscoverySnapshot();
  const clusterByInjector = new Map<Injector, GraphCluster>();
  const groupByDebugId = new Map<Injector, Map<string, GraphGroup>>();
  const registrationByDebugId = new Map<
    Injector,
    Map<string, GraphRegistration>
  >();
  const debugGroupsByInjector = new Map<
    Injector,
    readonly InjectorDebugIdentifierGroup[]
  >();
  const clusters: GraphCluster[] = [];
  const visitedInjectors = new Set<Injector>();

  const visit = (
    record: InjectorDiscoveryRecord,
    parentId: string | null,
    rootId: string,
  ): void => {
    if (visitedInjectors.has(record.injector)) return;
    visitedInjectors.add(record.injector);

    const id = clusterId(record);
    const acceptedChildren = record.children.filter(
      (child) => !visitedInjectors.has(child.injector),
    );
    const debugGroups = record.injector.debug.listRegistrations();
    const groupsByDebugId = new Map<string, GraphGroup>();
    const registrationsByDebugId = new Map<string, GraphRegistration>();

    const groups = debugGroups.map((debugGroup): GraphGroup => {
      const idForGroup = groupId(id, debugGroup.id);
      const registrations = debugGroup.registrations.map(
        (debugRegistration): GraphRegistration => {
          const registration: GraphRegistration = {
            debugId: debugRegistration.id,
            dependencies: [],
            ...(debugRegistration.dynamic
              ? { dynamic: debugRegistration.dynamic }
              : {}),
            groupId: idForGroup,
            id: registrationId(idForGroup, debugRegistration.id),
            identifierLabel: debugRegistration.identifierLabel,
            ...(debugRegistration.lazy ? { lazy: debugRegistration.lazy } : {}),
            ...(debugRegistration.loadedProviderKind
              ? { loadedProviderKind: debugRegistration.loadedProviderKind }
              : {}),
            providerKind: debugRegistration.providerKind,
            providerLabel: debugRegistration.providerLabel,
            status: debugRegistration.status,
          };
          registrationsByDebugId.set(debugRegistration.id, registration);
          return registration;
        },
      );
      const group: GraphGroup = {
        clusterId: id,
        debugId: debugGroup.id,
        id: idForGroup,
        identifierLabel: debugGroup.identifierLabel,
        registrations,
      };
      groupsByDebugId.set(debugGroup.id, group);
      return group;
    });

    const cluster: GraphCluster = {
      childIds: acceptedChildren.map(clusterId),
      discoveryId: record.id,
      groups,
      id,
      injector: record.injector,
      label: metadataLabel(record) ?? id,
      ...(record.metadata ? { metadata: record.metadata } : {}),
      parentId,
      rootId,
    };
    clusters.push(cluster);
    clusterByInjector.set(record.injector, cluster);
    groupByDebugId.set(record.injector, groupsByDebugId);
    registrationByDebugId.set(record.injector, registrationsByDebugId);
    debugGroupsByInjector.set(record.injector, debugGroups);

    acceptedChildren.forEach((child) => visit(child, id, rootId));
  };

  snapshot.roots.forEach((root) => {
    const id = clusterId(root);
    visit(root, null, id);
  });

  // A caller-supplied snapshot should still project every record, even if it
  // is malformed or contains a record omitted from `roots`.
  snapshot.records.forEach((record) => {
    if (!clusterByInjector.has(record.injector)) {
      const id = clusterId(record);
      visit(record, null, id);
    }
  });

  const edges: GraphEdge[] = [];
  for (const cluster of clusters) {
    const debugGroups = debugGroupsByInjector.get(cluster.injector) ?? [];
    for (const debugGroup of debugGroups) {
      const graphGroup = groupByDebugId
        .get(cluster.injector)
        ?.get(debugGroup.id);
      if (!graphGroup) continue;

      for (const debugRegistration of debugGroup.registrations) {
        const graphRegistration = registrationByDebugId
          .get(cluster.injector)
          ?.get(debugRegistration.id);
        if (!graphRegistration) continue;
        const dependencies =
          graphRegistration.dependencies as GraphDependency[];

        debugRegistration.dependencies.forEach((dependency, index) => {
          const explanation = cluster.injector.debug.explain({
            identifier: dependency.identifier,
            lookUp: dependency.lookUp,
            quantity: dependency.quantity,
            withNew: dependency.withNew,
          });
          let outcome: GraphEdgeOutcome = explanation.outcome;
          let targetClusterId: string | null = null;
          let targetGroupId: string | null = null;
          let targetRegistrationIds: readonly string[] = [];

          if (explanation.landing) {
            const targetCluster = clusterByInjector.get(
              explanation.landing.injector,
            );
            if (explanation.landing.synthetic === 'injector') {
              outcome = 'injector';
              targetClusterId = targetCluster?.id ?? null;
            } else if (!targetCluster) {
              outcome = 'external';
            } else {
              const targetGroup = groupByDebugId
                .get(explanation.landing.injector)
                ?.get(explanation.landing.groupId);
              targetClusterId = targetCluster.id;
              targetGroupId = targetGroup?.id ?? null;
              const targetRegistrations = registrationByDebugId.get(
                explanation.landing.injector,
              );
              targetRegistrationIds = explanation.landing.registrationIds
                .map((id) => targetRegistrations?.get(id)?.id)
                .filter((id): id is string => typeof id === 'string');
            }
          }

          const graphDependency: GraphDependency = {
            identifierLabel: dependency.identifierLabel,
            ...(dependency.lookUp ? { lookUp: dependency.lookUp } : {}),
            outcome,
            quantity: dependency.quantity,
            targetClusterId,
            targetGroupId,
            targetRegistrationIds,
            withNew: dependency.withNew,
          };
          dependencies.push(graphDependency);
          edges.push({
            id: `${graphRegistration.id}/dependency-${index}`,
            label: decorateDependency(dependency),
            ...(dependency.lookUp ? { lookUp: dependency.lookUp } : {}),
            outcome,
            quantity: dependency.quantity,
            sourceClusterId: cluster.id,
            sourceGroupId: graphGroup.id,
            sourceRegistrationId: graphRegistration.id,
            targetClusterId,
            targetGroupId,
            targetRegistrationIds,
            withNew: dependency.withNew,
          });
        });
      }
    }
  }

  // Keep the accidental extra-record handling above observable as roots.
  const knownRootIds = new Set(snapshot.roots.map(clusterId));
  for (const cluster of clusters) {
    if (cluster.parentId === null) knownRootIds.add(cluster.id);
  }

  return {
    clusters,
    edges,
    rootIds: [...knownRootIds],
  };
}

/** Focus a forest on one root while keeping source edges honest. */
export function filterGraphByRoot(
  model: GraphModel,
  rootId: string | null,
): GraphModel {
  if (rootId === null) return model;

  const retainedClusters = model.clusters.filter(
    (cluster) => cluster.rootId === rootId,
  );
  const clusterIds = new Set(retainedClusters.map((cluster) => cluster.id));
  const edges = model.edges
    .filter((edge) => clusterIds.has(edge.sourceClusterId))
    .map((edge): GraphEdge => {
      if (
        edge.targetClusterId === null ||
        clusterIds.has(edge.targetClusterId)
      ) {
        return edge;
      }
      return {
        ...edge,
        outcome: 'external',
        targetClusterId: null,
        targetGroupId: null,
        targetRegistrationIds: [],
      };
    });
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const clusters = retainedClusters.map((cluster): GraphCluster => ({
    ...cluster,
    groups: cluster.groups.map((group): GraphGroup => ({
      ...group,
      registrations: group.registrations.map(
        (registration): GraphRegistration => ({
          ...registration,
          dependencies: registration.dependencies.map((dependency, index) => {
            const edge = edgeById.get(
              `${registration.id}/dependency-${index}`,
            )!;
            return {
              ...dependency,
              outcome: edge.outcome,
              targetClusterId: edge.targetClusterId,
              targetGroupId: edge.targetGroupId,
              targetRegistrationIds: edge.targetRegistrationIds,
            };
          }),
        }),
      ),
    })),
  }));

  return {
    clusters,
    edges,
    rootIds: model.rootIds.filter((id) => id === rootId),
  };
}
