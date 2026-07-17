import type {
  Edge,
  EdgeProps,
  Node,
  NodeProps,
  ReactFlowInstance,
} from '@xyflow/react';
import type {
  GraphCluster,
  GraphEdge,
  GraphModel,
  GraphRegistration,
} from '../graph/model';
import type {
  CanvasEdgeModel,
  CanvasNodeModel,
  GraphIndex,
} from './graphCanvasModel';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { projectDependencyGraph } from '../graph/project';
import {
  buildCanvasGraph,
  createGraphIndex,
  dependencyHandles,
  highlightedRelationships,
  indexCanvasNodeKinds,
  layoutCanvasGraph,
  rootTreeIds,
} from './graphCanvasModel';
import '@xyflow/react/dist/base.css';
import './DebuggerPanel.css';

export interface DebuggerPanelProps {
  readonly className?: string;
  /** Milliseconds between projections. `false` (or a non-positive value) disables polling. */
  readonly pollInterval?: number | false;
  readonly style?: React.CSSProperties;
}

type GraphSelection =
  | { readonly id: string; readonly kind: 'injector' }
  | { readonly id: string; readonly kind: 'registration' };

interface InjectorNodeData extends Record<string, unknown> {
  readonly childCount: number;
  readonly color: string;
  readonly contentsCollapsed: boolean;
  readonly discoveryId: number;
  readonly hasChildren: boolean;
  readonly label: string;
  readonly onCenter: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onToggleContents: (id: string) => void;
  readonly onToggleSubtree: (id: string) => void;
  readonly registrationCount: number;
  readonly selected: boolean;
  readonly subtreeCollapsed: boolean;
}

interface GroupNodeData extends Record<string, unknown> {
  readonly identifierLabel: string;
  readonly registrationCount: number;
}

interface RegistrationNodeData extends Record<string, unknown> {
  readonly dimmed: boolean;
  readonly dynamic: boolean;
  readonly lazy: boolean;
  readonly onSelect: (id: string) => void;
  readonly providerKind: string;
  readonly providerLabel: string;
  readonly selected: boolean;
  readonly status: string;
}

type TerminalNodeData = Record<string, unknown>;

interface DependencyEdgeData extends Record<string, unknown> {
  readonly aggregated: boolean;
  readonly alias: boolean;
  readonly count: number;
  readonly dimmed: boolean;
  readonly emphasized: boolean;
  readonly hovered: boolean;
  readonly label: string;
  readonly onHover: (id: string) => void;
  readonly onLeave: (id: string) => void;
  readonly outcome?: GraphEdge['outcome'];
}

type InjectorFlowNode = Node<InjectorNodeData, 'injector'>;
type GroupFlowNode = Node<GroupNodeData, 'identifierGroup'>;
type RegistrationFlowNode = Node<RegistrationNodeData, 'registration'>;
type TerminalFlowNode = Node<TerminalNodeData, 'terminal'>;
type FlowNode =
  | GroupFlowNode
  | InjectorFlowNode
  | RegistrationFlowNode
  | TerminalFlowNode;
type DependencyFlowEdge = Edge<DependencyEdgeData, 'dependency'>;
type StructuralFlowEdge = Edge<Record<string, never>, 'smoothstep'>;
type FlowEdge = DependencyFlowEdge | StructuralFlowEdge;

interface SearchResult {
  readonly description: string;
  readonly id: string;
  readonly kind: GraphSelection['kind'];
  readonly label: string;
}

const DEFAULT_POLL_INTERVAL = 2000;
const INJECTOR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#0891b2',
  '#059669',
  '#d97706',
  '#db2777',
] as const;

const outcomeLabels: Record<GraphEdge['outcome'], string> = {
  external: 'outside active tree',
  injector: 'Injector itself',
  'many-empty': 'many: empty',
  'optional-missing': 'optional: missing',
  'quantity-mismatch': 'quantity mismatch',
  'required-missing': 'required: missing',
  resolved: 'resolved',
};

function clusterColor(cluster: GraphCluster): string {
  return INJECTOR_COLORS[cluster.discoveryId % INJECTOR_COLORS.length];
}

const InjectorNode = memo(({
  data,
  id,
}: NodeProps<InjectorFlowNode>) => {
  return (
    <section
      className={`redi-devtools__injector-node${
        data.selected ? ' is-selected' : ''
      }`}
      data-redi-devtools-cluster={id}
      style={{ '--redi-injector-color': data.color } as React.CSSProperties}
    >
      <Handle
        className="redi-devtools__structural-handle"
        id="structure-target"
        position={Position.Top}
        type="target"
      />
      <header className="redi-devtools__injector-header">
        <button
          className="redi-devtools__injector-title nodrag"
          onClick={() => data.onSelect(id)}
          type="button"
        >
          <span className="redi-devtools__injector-dot" aria-hidden="true" />
          <span>
            <strong>{data.label}</strong>
            <small>
              #
{data.discoveryId}
{' '}
·
{' '}
{data.registrationCount}
{' '}
registrations ·
{' '}
              {data.childCount}
{' '}
children
            </small>
          </span>
        </button>
        <div className="redi-devtools__injector-actions nodrag">
          <button
            aria-label={`Center ${data.label}`}
            onClick={() => data.onCenter(id)}
            title="Center Injector"
            type="button"
          >
            ◎
          </button>
          <button
            aria-label={`${
              data.contentsCollapsed ? 'Show' : 'Hide'
            } registrations in ${data.label}`}
            onClick={() => data.onToggleContents(id)}
            title={
              data.contentsCollapsed
                ? 'Show registrations'
                : 'Hide registrations'
            }
            type="button"
          >
            {data.contentsCollapsed ? '▣' : '□'}
          </button>
          <button
            aria-label={`${
              data.subtreeCollapsed ? 'Show' : 'Hide'
            } subtree of ${data.label}`}
            disabled={!data.hasChildren}
            onClick={() => data.onToggleSubtree(id)}
            title={
              data.subtreeCollapsed ? 'Show child Injectors' : 'Hide subtree'
            }
            type="button"
          >
            {data.subtreeCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </header>
      {data.contentsCollapsed
? (
        <div className="redi-devtools__injector-collapsed">
          {data.registrationCount}
{' '}
registrations hidden
        </div>
      )
: null}
      <Handle
        className="redi-devtools__dependency-handle"
        id="dependency-target"
        position={Position.Bottom}
        style={{ left: '38%' }}
        type="target"
      />
      <Handle
        className="redi-devtools__dependency-handle"
        id="dependency-source"
        position={Position.Top}
        style={{ left: '62%' }}
        type="source"
      />
      <Handle
        className="redi-devtools__structural-handle"
        id="structure-source"
        position={Position.Bottom}
        type="source"
      />
    </section>
  );
});

const IdentifierGroupNode = memo(({
  data,
  id,
}: NodeProps<GroupFlowNode>) => {
  return (
    <section
      className="redi-devtools__group-node"
      data-redi-devtools-group={id}
      aria-label={`Identifier Group ${data.identifierLabel}`}
    >
      <header>
        <strong>{data.identifierLabel}</strong>
        <span>{data.registrationCount}</span>
      </header>
    </section>
  );
});

const RegistrationNode = memo(({
  data,
  id,
}: NodeProps<RegistrationFlowNode>) => {
  return (
    <button
      className={`redi-devtools__registration-node nodrag${
        data.selected ? ' is-selected' : ''
      }${data.dimmed ? ' is-dimmed' : ''}`}
      data-redi-devtools-registration={id}
      onClick={() => data.onSelect(id)}
      type="button"
    >
      <Handle
        data-redi-devtools-registration-target=""
        position={Position.Bottom}
        type="target"
      />
      <span className="redi-devtools__registration-provider">
        <strong>{data.providerLabel}</strong>
        <small>{data.providerKind}</small>
      </span>
      <span className="redi-devtools__registration-badges">
        <span data-status={data.status}>{data.status}</span>
        {data.lazy ? <span>lazy</span> : null}
        {data.dynamic ? <span>dynamic</span> : null}
      </span>
      <Handle
        data-redi-devtools-registration-source=""
        position={Position.Top}
        type="source"
      />
    </button>
  );
});

const TerminalNode = memo((_props: NodeProps<TerminalFlowNode>) => {
  return (
    <div
      aria-hidden="true"
      className="redi-devtools__terminal-anchor"
    >
      <Handle position={Position.Top} type="target" />
    </div>
  );
});

const DependencyEdge = memo(({
  data,
  id,
  markerEnd,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<DependencyFlowEdge>) => {
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: 10,
    offset: 24,
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const emphasized = data?.emphasized ?? false;
  const dimmed = data?.dimmed ?? false;
  const aggregated = data?.aggregated ?? false;
  const alias = data?.alias ?? false;
  const hovered = data?.hovered ?? false;
  const color = emphasized
    ? '#2563eb'
    : alias
      ? '#9333ea'
    : aggregated
      ? '#7c3aed'
      : '#64748b';
  const opacity = emphasized ? 0.98 : dimmed ? 0.08 : aggregated ? 0.68 : 0.48;

  return (
    <>
      <g>
        <BaseEdge
          className={alias
            ? 'redi-devtools__alias-edge-path'
            : 'redi-devtools__dependency-edge-path'}
          interactionWidth={0}
          markerEnd={alias ? undefined : markerEnd}
          path={path}
          style={{
            opacity,
            stroke: color,
            strokeDasharray: alias ? '3 4' : aggregated ? '6 4' : undefined,
            strokeWidth: emphasized ? 2.5 : aggregated ? 1.8 : 1.5,
            transition: 'opacity 160ms ease, stroke 160ms ease',
          }}
        />
        {alias
? (
          <circle
            cx={targetX}
            cy={targetY}
            fill="#fff"
            r={4}
            stroke={color}
            strokeWidth={2}
          />
        )
: null}
        <path
          className="redi-devtools__dependency-edge-hit-area"
          d={path}
          fill="none"
          onPointerOut={() => data?.onLeave(id)}
          onPointerOver={() => data?.onHover(id)}
          stroke="transparent"
          strokeWidth={20}
        />
      </g>
      {data?.label
? (
        <EdgeLabelRenderer>
          <span
            className={`redi-devtools__edge-label nodrag nopan${
              emphasized ? ' is-emphasized' : ''
            }${hovered ? ' is-hovered' : ''
            }`}
            data-redi-devtools-edge-label={id}
            style={{
              opacity: emphasized ? 1 : dimmed ? 0.1 : aggregated ? 0.85 : 0.62,
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )
: null}
    </>
  );
});

const nodeTypes = {
  identifierGroup: IdentifierGroupNode,
  injector: InjectorNode,
  registration: RegistrationNode,
  terminal: TerminalNode,
};
const edgeTypes = { dependency: DependencyEdge };

function edgeTarget(index: GraphIndex, edge: GraphEdge): string {
  if (edge.targetRegistrationIds.length > 0) {
    return edge.targetRegistrationIds
      .map((id) => {
        const registration = index.registrationById.get(id);
        const cluster = index.clusterByRegistrationId.get(id);
        if (!registration) return id;
        return `${cluster?.label ?? 'Injector'} / ${registration.providerLabel}`;
      })
      .join(', ');
  }
  if (edge.targetClusterId) {
    return index.clusterById.get(edge.targetClusterId)?.label ?? edge.targetClusterId;
  }
  return outcomeLabels[edge.outcome];
}

function DependencyList({
  edges,
  index,
}: {
  readonly edges: readonly GraphEdge[];
  readonly index: GraphIndex;
}) {
  return (
    <>
      {edges.length === 0 ? <p className="redi-devtools__muted">None</p> : null}
      <ul className="redi-devtools__details-edges">
        {edges.map((edge) => (
          <li key={edge.id}>
            <code>{edge.label}</code>
            <span>{edgeTarget(index, edge)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Details({
  index,
  selection,
}: {
  readonly index: GraphIndex;
  readonly selection: GraphSelection | null;
}) {
  if (!selection) {
    return <p className="redi-devtools__muted">Select an Injector or Registration.</p>;
  }

  if (selection.kind === 'injector') {
    const cluster = index.clusterById.get(selection.id);
    if (!cluster) return null;
    const registrationCount = cluster.groups.reduce(
      (count, group) => count + group.registrations.length,
      0,
    );
    return (
      <>
        <span className="redi-devtools__details-kicker">Injector</span>
        <h3>{cluster.label}</h3>
        <dl className="redi-devtools__details-list">
          <dt>Discovery ID</dt>
          <dd>
#
{cluster.discoveryId}
          </dd>
          <dt>Parent</dt>
          <dd>
            {cluster.parentId
              ? (index.clusterById.get(cluster.parentId)?.label ?? cluster.parentId)
              : 'Root'}
          </dd>
          <dt>Children</dt>
          <dd>{cluster.childIds.length}</dd>
          <dt>Groups</dt>
          <dd>{cluster.groups.length}</dd>
          <dt>Registrations</dt>
          <dd>{registrationCount}</dd>
        </dl>
        {cluster.metadata
? (
          <>
            <h4>Discovery metadata</h4>
            <pre>{JSON.stringify(cluster.metadata, null, 2)}</pre>
          </>
        )
: null}
      </>
    );
  }

  const registration = index.registrationById.get(selection.id);
  if (!registration) return null;
  const cluster = index.clusterByRegistrationId.get(registration.id);
  const outgoing = index.outgoingByRegistrationId.get(registration.id) ?? [];
  const incoming = index.incomingByRegistrationId.get(registration.id) ?? [];
  return (
    <>
      <span className="redi-devtools__details-kicker">Registration</span>
      <h3>{registration.identifierLabel}</h3>
      <dl className="redi-devtools__details-list">
        <dt>Provider</dt>
        <dd>{registration.providerLabel}</dd>
        <dt>Kind</dt>
        <dd>{registration.providerKind}</dd>
        <dt>Injector</dt>
        <dd>{cluster?.label ?? registration.groupId}</dd>
        <dt>Status</dt>
        <dd>{registration.status}</dd>
        <dt>Lazy</dt>
        <dd>{registration.lazy ? 'yes' : 'no'}</dd>
      </dl>
      <h4>Outgoing dependencies</h4>
      <DependencyList edges={outgoing} index={index} />
      <h4>Direct incoming dependencies</h4>
      <DependencyList edges={incoming} index={index} />
    </>
  );
}

function countRegistrations(cluster: GraphCluster): number {
  return cluster.groups.reduce(
    (count, group) => count + group.registrations.length,
    0,
  );
}

function makeFlowNodes(
  canvasNodes: readonly CanvasNodeModel[],
  layout: ReadonlyMap<string, Readonly<{ height: number; width: number; x: number; y: number }>>,
  selection: GraphSelection | null,
  highlightedRegistrationIds: ReadonlySet<string>,
  collapsedContents: ReadonlySet<string>,
  collapsedSubtrees: ReadonlySet<string>,
  onCenter: (id: string) => void,
  onSelectInjector: (id: string) => void,
  onSelectRegistration: (id: string) => void,
  onToggleContents: (id: string) => void,
  onToggleSubtree: (id: string) => void,
): readonly FlowNode[] {
  const hasSelection = selection?.kind === 'registration';

  return canvasNodes.flatMap((node): readonly FlowNode[] => {
    const geometry = layout.get(node.id);
    if (!geometry) return [];
    const common = {
      draggable: false,
      height: geometry.height,
      id: node.id,
      position: { x: geometry.x, y: geometry.y },
      selectable: false,
      width: geometry.width,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      style: { height: geometry.height, width: geometry.width },
    };

    if (node.kind === 'injector') {
      const cluster = node.source as GraphCluster;
      return [
        {
          ...common,
          data: {
            childCount: cluster.childIds.length,
            color: clusterColor(cluster),
            contentsCollapsed: collapsedContents.has(cluster.id),
            discoveryId: cluster.discoveryId,
            hasChildren: cluster.childIds.length > 0,
            label: cluster.label,
            onCenter,
            onSelect: onSelectInjector,
            onToggleContents,
            onToggleSubtree,
            registrationCount: countRegistrations(cluster),
            selected:
              selection?.kind === 'injector' && selection.id === cluster.id,
            subtreeCollapsed: collapsedSubtrees.has(cluster.id),
          },
          type: 'injector',
          zIndex: 0,
        },
      ];
    }
    if (node.kind === 'group') {
      const group = node.source as import('../graph/model').GraphGroup;
      return [
        {
          ...common,
          data: {
            identifierLabel: group.identifierLabel,
            registrationCount: group.registrations.length,
          },
          extent: 'parent',
          type: 'identifierGroup',
          zIndex: 1,
        },
      ];
    }
    if (node.kind === 'registration') {
      const registration = node.source as GraphRegistration;
      return [
        {
          ...common,
          data: {
            dimmed:
              hasSelection && !highlightedRegistrationIds.has(registration.id),
            dynamic: registration.dynamic ?? false,
            lazy: registration.lazy ?? false,
            onSelect: onSelectRegistration,
            providerKind: registration.providerKind,
            providerLabel: registration.providerLabel,
            selected:
              selection?.kind === 'registration' &&
              selection.id === registration.id,
            status: registration.status,
          },
          extent: 'parent',
          type: 'registration',
          zIndex: 2,
        },
      ];
    }
    return [
      {
        ...common,
        data: {},
        extent: 'parent',
        type: 'terminal',
        zIndex: 2,
      },
    ];
  });
}

function makeFlowEdges(
  canvasNodes: readonly CanvasNodeModel[],
  canvasEdges: readonly CanvasEdgeModel[],
  highlightedEdgeIds: ReadonlySet<string>,
  hasRegistrationSelection: boolean,
  hoveredEdgeId: string | null,
  onHover: (id: string) => void,
  onLeave: (id: string) => void,
): readonly FlowEdge[] {
  const nodeKinds = indexCanvasNodeKinds(canvasNodes);
  return canvasEdges.map((edge): FlowEdge => {
    if (edge.kind === 'structural') {
      return {
        data: {},
        id: edge.id,
        source: edge.source,
        sourceHandle: 'structure-source',
        style: { stroke: '#94a3b8', strokeWidth: 3 },
        target: edge.target,
        targetHandle: 'structure-target',
        type: 'smoothstep',
        zIndex: -1,
      };
    }
    const emphasized = edge.originalEdgeIds.some((id) =>
      highlightedEdgeIds.has(id),
    );
    const hovered = edge.id === hoveredEdgeId;
    const handles = dependencyHandles(nodeKinds, edge);
    return {
      data: {
        aggregated: edge.aggregated,
        alias: edge.kind === 'alias',
        count: edge.count,
        dimmed: hasRegistrationSelection && !emphasized,
        emphasized,
        hovered,
        label: edge.label ?? '',
        onHover,
        onLeave,
        ...(edge.outcome ? { outcome: edge.outcome } : {}),
      },
      id: edge.id,
      markerEnd: {
        color: emphasized ? '#2563eb' : '#64748b',
        height: 14,
        type: MarkerType.ArrowClosed,
        width: 14,
      },
      source: edge.source,
      ...(handles.sourceHandle
        ? { sourceHandle: handles.sourceHandle }
        : {}),
      target: edge.target,
      ...(handles.targetHandle
        ? { targetHandle: handles.targetHandle }
        : {}),
      type: 'dependency',
      zIndex: hovered ? 1000 : 3,
    };
  });
}

function PanelContent({ className, pollInterval, style }: DebuggerPanelProps) {
  const [model, setModel] = useState<GraphModel>(() =>
    projectDependencyGraph(),
  );
  const [activeRootId, setActiveRootId] = useState<string | null>(
    () => model.rootIds[0] ?? null,
  );
  const [collapsedContents, setCollapsedContents] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedSubtrees, setCollapsedSubtrees] = useState<Set<string>>(
    () => new Set(),
  );
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsWidth, setDetailsWidth] = useState(300);
  const [query, setQuery] = useState('');
  const [pendingCenterId, setPendingCenterId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Awaited<
    ReturnType<typeof layoutCanvasGraph>
  > | null>(null);
  const flowRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const index = useMemo(() => createGraphIndex(model), [model]);

  const activePollInterval =
    typeof pollInterval === 'number' &&
    Number.isFinite(pollInterval) &&
    pollInterval > 0
      ? pollInterval
      : pollInterval === undefined
        ? DEFAULT_POLL_INTERVAL
        : null;

  const refresh = useCallback(() => {
    setModel(projectDependencyGraph());
  }, []);

  useEffect(() => {
    if (activePollInterval === null) return;
    const interval = window.setInterval(refresh, activePollInterval);
    return () => window.clearInterval(interval);
  }, [activePollInterval, refresh]);

  useEffect(() => {
    if (activeRootId && model.rootIds.includes(activeRootId)) return;
    setActiveRootId(model.rootIds[0] ?? null);
    setCollapsedContents(new Set());
    setCollapsedSubtrees(new Set());
    setSelection(null);
  }, [activeRootId, model.rootIds]);

  const canvasGraph = useMemo(
    () =>
      activeRootId
        ? buildCanvasGraph(model, {
            collapsedContents,
            collapsedSubtrees,
            rootId: activeRootId,
          })
        : null,
    [activeRootId, collapsedContents, collapsedSubtrees, model],
  );

  useEffect(() => {
    if (!canvasGraph) {
      setLayout(null);
      return;
    }
    if (layout?.structureKey === canvasGraph.structureKey) return;
    let cancelled = false;
    void layoutCanvasGraph(canvasGraph).then((nextLayout) => {
      if (!cancelled) setLayout(nextLayout);
    });
    return () => {
      cancelled = true;
    };
  }, [canvasGraph, layout?.structureKey]);

  const centerNode = useCallback((id: string) => {
    const instance = flowRef.current;
    const node = instance?.getNode(id);
    if (!instance || !node) return;
    void instance.fitView({
      duration: 280,
      maxZoom: 1.15,
      nodes: [node],
      padding: 0.28,
    });
  }, []);

  useEffect(() => {
    if (!pendingCenterId || !layout) return;
    const frame = window.requestAnimationFrame(() => {
      centerNode(pendingCenterId);
      setPendingCenterId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerNode, layout, pendingCenterId]);

  const selectInjector = useCallback((id: string) => {
    setSelection({ id, kind: 'injector' });
    setDetailsOpen(true);
  }, []);
  const selectRegistration = useCallback((id: string) => {
    setSelection({ id, kind: 'registration' });
    setDetailsOpen(true);
  }, []);
  const toggleSetValue = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );
  const toggleContents = useCallback(
    (id: string) => toggleSetValue(setCollapsedContents, id),
    [toggleSetValue],
  );
  const toggleSubtree = useCallback(
    (id: string) => toggleSetValue(setCollapsedSubtrees, id),
    [toggleSetValue],
  );
  const hoverEdge = useCallback((id: string) => {
    setHoveredEdgeId(id);
  }, []);
  const leaveEdge = useCallback((id: string) => {
    setHoveredEdgeId((current) => current === id ? null : current);
  }, []);

  const highlighted = useMemo(
    () =>
      highlightedRelationships(
        model,
        selection?.kind === 'registration' ? selection.id : null,
      ),
    [model, selection],
  );

  const flowNodes = useMemo(
    () =>
      canvasGraph && layout?.structureKey === canvasGraph.structureKey
        ? makeFlowNodes(
            canvasGraph.nodes,
            layout.byId,
            selection,
            highlighted.registrationIds,
            collapsedContents,
            collapsedSubtrees,
            centerNode,
            selectInjector,
            selectRegistration,
            toggleContents,
            toggleSubtree,
          )
        : [],
    [
      canvasGraph,
      centerNode,
      collapsedContents,
      collapsedSubtrees,
      highlighted.registrationIds,
      layout,
      selectInjector,
      selectRegistration,
      selection,
      toggleContents,
      toggleSubtree,
    ],
  );
  const flowEdges = useMemo(
    () =>
      canvasGraph
        ? makeFlowEdges(
            canvasGraph.nodes,
            canvasGraph.edges,
            highlighted.edgeIds,
            selection?.kind === 'registration',
            hoveredEdgeId,
            hoverEdge,
            leaveEdge,
          )
        : [],
    [
      canvasGraph,
      highlighted.edgeIds,
      hoverEdge,
      hoveredEdgeId,
      leaveEdge,
      selection?.kind,
    ],
  );

  const activeTreeIds = useMemo(
    () =>
      activeRootId ? rootTreeIds(model, activeRootId) : new Set<string>(),
    [activeRootId, model],
  );
  const searchResults = useMemo((): readonly SearchResult[] => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const results: SearchResult[] = [];
    for (const clusterId of activeTreeIds) {
      const cluster = index.clusterById.get(clusterId);
      if (!cluster) continue;
      if (
        `${cluster.label} ${cluster.id}`.toLocaleLowerCase().includes(normalized)
      ) {
        results.push({
          description: `${countRegistrations(cluster)} registrations`,
          id: cluster.id,
          kind: 'injector',
          label: cluster.label,
        });
      }
      for (const group of cluster.groups) {
        for (const registration of group.registrations) {
          const haystack = `${registration.identifierLabel} ${
            registration.providerLabel
          } ${cluster.label}`.toLocaleLowerCase();
          if (!haystack.includes(normalized)) continue;
          results.push({
            description: `${registration.providerLabel} · ${cluster.label}`,
            id: registration.id,
            kind: 'registration',
            label: registration.identifierLabel,
          });
        }
      }
    }
    return results.slice(0, 12);
  }, [activeTreeIds, index, query]);

  const revealAndCenter = useCallback(
    (result: SearchResult) => {
      const cluster =
        result.kind === 'injector'
          ? index.clusterById.get(result.id)
          : index.clusterByRegistrationId.get(result.id);
      if (!cluster) return;
      const ancestors = new Set<string>();
      let current: GraphCluster | undefined = cluster;
      while (current) {
        ancestors.add(current.id);
        current = current.parentId
          ? index.clusterById.get(current.parentId)
          : undefined;
      }
      setCollapsedSubtrees((existing) => {
        const next = new Set(existing);
        ancestors.forEach((id) => next.delete(id));
        return next;
      });
      if (result.kind === 'registration') {
        setCollapsedContents((existing) => {
          const next = new Set(existing);
          next.delete(cluster.id);
          return next;
        });
        setSelection({ id: result.id, kind: 'registration' });
      } else {
        setSelection({ id: result.id, kind: 'injector' });
      }
      setDetailsOpen(true);
      setPendingCenterId(result.id);
      setQuery('');
    },
    [index],
  );

  const selectRoot = useCallback((id: string) => {
    setActiveRootId(id);
    setCollapsedContents(new Set());
    setCollapsedSubtrees(new Set());
    setSelection(null);
    setQuery('');
    setDetailsOpen(false);
    setLayout(null);
  }, []);

  const beginResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = detailsWidth;
      const move = (moveEvent: PointerEvent) => {
        setDetailsWidth(
          Math.min(520, Math.max(240, startWidth + startX - moveEvent.clientX)),
        );
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop, { once: true });
    },
    [detailsWidth],
  );

  const activeClusterCount = activeTreeIds.size;
  const activeEdgeCount = model.edges.filter((edge) =>
    activeTreeIds.has(edge.sourceClusterId),
  ).length;

  return (
    <div
      className={`redi-devtools${className ? ` ${className}` : ''}`}
      data-redi-devtools-panel=""
      style={style}
    >
      <header className="redi-devtools__toolbar">
        <label className="redi-devtools__root-switch">
          <span>Root Injector</span>
          <select
            aria-label="Root Injector"
            disabled={model.rootIds.length === 0}
            onChange={(event) => selectRoot(event.target.value)}
            value={activeRootId ?? ''}
          >
            {model.rootIds.length === 0
? (
              <option value="">No roots</option>
            )
: null}
            {model.rootIds.map((id) => (
              <option key={id} value={id}>
                {index.clusterById.get(id)?.label ?? id}
              </option>
            ))}
          </select>
        </label>
        <div className="redi-devtools__search-wrap">
          <input
            aria-label="Search active Injector tree"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Injector, Identifier, Provider…"
            type="search"
            value={query}
          />
          {query.trim()
? (
            <div className="redi-devtools__search-results" role="listbox">
              {searchResults.length === 0
? (
                <span>No matches in this root tree.</span>
              )
: null}
              {searchResults.map((result) => (
                <button
                  key={`${result.kind}/${result.id}`}
                  onClick={() => revealAndCenter(result)}
                  role="option"
                  type="button"
                >
                  <strong>{result.label}</strong>
                  <small>{result.description}</small>
                </button>
              ))}
            </div>
          )
: null}
        </div>
        <button className="redi-devtools__toolbar-button" onClick={refresh} type="button">
          Refresh
        </button>
        <button
          aria-expanded={detailsOpen}
          className="redi-devtools__toolbar-button"
          onClick={() => setDetailsOpen((open) => !open)}
          type="button"
        >
          Details
        </button>
        <span className="redi-devtools__summary">
          {activeClusterCount}
{' '}
injectors ·
{activeEdgeCount}
{' '}
dependencies
{activePollInterval === null
            ? ' · polling off'
            : ` · polling ${activePollInterval}ms`}
        </span>
      </header>

      <div className="redi-devtools__body">
        <div className="redi-devtools__canvas" data-redi-devtools-canvas="">
          {!activeRootId
? (
            <div className="redi-devtools__empty">No live Injectors discovered.</div>
          )
: flowNodes.length === 0
? (
            <div className="redi-devtools__empty">Laying out Injector tree…</div>
          )
: (
            <ReactFlow<FlowNode, FlowEdge>
              colorMode="light"
              edges={[...flowEdges]}
              edgeTypes={edgeTypes}
              elementsSelectable={false}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: 0.16 }}
              maxZoom={1.8}
              minZoom={0.08}
              nodeTypes={nodeTypes}
              nodes={[...flowNodes]}
              nodesConnectable={false}
              nodesDraggable={false}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
              panOnScroll
              proOptions={{ hideAttribution: true }}
              zoomOnDoubleClick={false}
              zoomOnScroll={false}
              zIndexMode="manual"
            >
              <Background color="#cbd5e1" gap={20} size={1} />
              <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        {detailsOpen
? (
          <aside
            className="redi-devtools__details"
            data-redi-devtools-details=""
            style={{ width: detailsWidth }}
          >
            <div
              aria-label="Resize details panel"
              aria-orientation="vertical"
              className="redi-devtools__details-resizer"
              onPointerDown={beginResize}
              role="separator"
            />
            <header>
              <h2>Details</h2>
              <button
                aria-label="Close details"
                onClick={() => setDetailsOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="redi-devtools__details-content">
              <Details index={index} selection={selection} />
            </div>
          </aside>
        )
: null}
      </div>
    </div>
  );
}

/** Embeddable, side-effect-free-until-rendered Dependency Graph surface. */
export function DebuggerPanel(props: DebuggerPanelProps) {
  return (
    <ReactFlowProvider>
      <PanelContent {...props} />
    </ReactFlowProvider>
  );
}
