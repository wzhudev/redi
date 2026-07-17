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
  MiniMap,
  Panel,
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
  readonly identifierLabel: string;
  readonly lazy: boolean;
  readonly onSelect: (id: string) => void;
  readonly providerKind: string;
  readonly providerLabel: string;
  readonly selected: boolean;
  readonly status: string;
}

interface TerminalNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly tone: string;
}

interface DependencyEdgeData extends Record<string, unknown> {
  readonly aggregated: boolean;
  readonly alias: boolean;
  readonly color: string;
  readonly count: number;
  readonly dimmed: boolean;
  readonly emphasized: boolean;
  readonly hovered: boolean;
  readonly hoverLabel: string;
  readonly label: string;
  readonly onHover: (id: string) => void;
  readonly onLeave: (id: string) => void;
  readonly outcome?: GraphEdge['outcome'];
  readonly pathOffset: number;
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

type TerminalTone = 'danger' | 'muted' | 'warning';

const terminalTones: Record<GraphEdge['outcome'], TerminalTone> = {
  external: 'muted',
  injector: 'muted',
  'many-empty': 'warning',
  'optional-missing': 'warning',
  'quantity-mismatch': 'danger',
  'required-missing': 'danger',
  resolved: 'muted',
};

function dependencyEdgeColor(
  edge: Readonly<{
    aggregated: boolean;
    alias: boolean;
    emphasized: boolean;
    outcome?: GraphEdge['outcome'];
  }>,
): string {
  if (
    edge.outcome === 'required-missing' ||
    edge.outcome === 'quantity-mismatch'
  ) {
    return '#dc2626';
  }
  if (edge.outcome === 'optional-missing' || edge.outcome === 'many-empty') {
    return '#d97706';
  }
  if (edge.emphasized) return '#2563eb';
  if (edge.alias) return '#9333ea';
  if (edge.aggregated) return '#7c3aed';
  return '#64748b';
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function GlyphIcon({ d }: { readonly d: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="12"
    >
      <path d={d} />
    </svg>
  );
}

const glyphs = {
  center:
    'M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5M8 5.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z',
  chevronDown: 'M4 6l4 4 4-4',
  chevronRight: 'M6 4l4 4-4 4',
  close: 'M4 4l8 8M12 4l-8 8',
  rows: 'M2.5 3.5h11M2.5 8h11M2.5 12.5h11',
  rowsHidden: 'M2.5 3.5h11M2.5 8h6M2.5 12.5h3',
} as const;

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

const InjectorNode = memo(({ data, id }: NodeProps<InjectorFlowNode>) => {
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
              {`#${data.discoveryId} · ${pluralize(
                data.registrationCount,
                'registration',
                'registrations',
              )} · ${pluralize(data.childCount, 'child', 'children')}`}
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
            <GlyphIcon d={glyphs.center} />
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
            <GlyphIcon
              d={data.contentsCollapsed ? glyphs.rowsHidden : glyphs.rows}
            />
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
            <GlyphIcon
              d={
                data.subtreeCollapsed ? glyphs.chevronRight : glyphs.chevronDown
              }
            />
          </button>
        </div>
      </header>
      {data.contentsCollapsed
? (
        <div className="redi-devtools__injector-collapsed">
          {`${pluralize(
            data.registrationCount,
            'registration',
            'registrations',
          )} hidden`}
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

const IdentifierGroupNode = memo(({ data, id }: NodeProps<GroupFlowNode>) => {
  return (
    <section
      className="redi-devtools__group-node"
      data-redi-devtools-group={id}
      aria-label={`Identifier Group ${data.identifierLabel}`}
    >
      <header>
        <strong>{data.identifierLabel}</strong>
        {data.registrationCount > 1
? (
          <span>{data.registrationCount}</span>
        )
: null}
      </header>
    </section>
  );
});

const RegistrationNode = memo(
  ({ data, id }: NodeProps<RegistrationFlowNode>) => {
    // Skip text the surrounding chrome already shows: the provider name when
    // it matches the group's identifier, the kind when it matches the name.
    const showProviderLabel = data.providerLabel !== data.identifierLabel;
    const showProviderKind = data.providerKind !== data.providerLabel;
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
          className="redi-devtools__hidden-handle"
          data-redi-devtools-registration-target=""
          position={Position.Bottom}
          type="target"
        />
        <span className="redi-devtools__registration-provider">
          {showProviderLabel ? <strong>{data.providerLabel}</strong> : null}
          {showProviderKind ? <small>{data.providerKind}</small> : null}
        </span>
        <span className="redi-devtools__registration-badges">
          <span data-status={data.status}>{data.status}</span>
          {data.lazy ? <span>lazy</span> : null}
          {data.dynamic ? <span>dynamic</span> : null}
        </span>
        <Handle
          className="redi-devtools__hidden-handle"
          data-redi-devtools-registration-source=""
          position={Position.Top}
          type="source"
        />
      </button>
    );
  },
);

const TerminalNode = memo(({ data }: NodeProps<TerminalFlowNode>) => {
  return (
    <div className="redi-devtools__terminal-node" data-tone={data.tone}>
      <Handle
        className="redi-devtools__hidden-handle"
        position={Position.Top}
        type="target"
      />
      {data.label}
    </div>
  );
});

/**
 * Anchor edge badges next to their source instead of the path midpoint —
 * long detour edges have midpoints in visually unrelated territory.
 */
function labelAnchor(
  position: Position,
  x: number,
  y: number,
): Readonly<{ x: number; y: number }> {
  const distance = 30;
  if (position === Position.Top) return { x, y: y - distance };
  if (position === Position.Bottom) return { x, y: y + distance };
  if (position === Position.Left) return { x: x - distance, y };
  return { x: x + distance, y };
}

const DependencyEdge = memo(
  ({
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
    const [path] = getSmoothStepPath({
      borderRadius: 10,
      offset: data?.pathOffset ?? 24,
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
    const count = data?.count ?? 1;
    const color = data?.color ?? '#64748b';
    const failed =
      data?.outcome !== undefined &&
      data.outcome !== 'resolved' &&
      data.outcome !== 'injector' &&
      data.outcome !== 'external';
    const opacity =
      hovered || emphasized
        ? 1
        : dimmed
          ? 0.18
          : failed
            ? 0.85
            : aggregated
              ? 0.68
              : 0.5;
    const badgeLabel = [
      data?.label,
      aggregated && count > 1 ? `× ${count}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const displayLabel = hovered ? data?.hoverLabel || badgeLabel : badgeLabel;
    const anchor = labelAnchor(sourcePosition, sourceX, sourceY);

    return (
      <>
        <g>
          <BaseEdge
            className={
              alias
                ? 'redi-devtools__alias-edge-path'
                : 'redi-devtools__dependency-edge-path'
            }
            interactionWidth={0}
            markerEnd={alias ? undefined : markerEnd}
            path={path}
            style={{
              opacity,
              stroke: color,
              strokeDasharray: alias ? '3 4' : aggregated ? '6 4' : undefined,
              strokeWidth:
                hovered || emphasized ? 2.4 : aggregated || failed ? 1.8 : 1.5,
              transition:
                'opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease',
            }}
          />
          {alias
? (
            <circle
              cx={targetX}
              cy={targetY}
              fill="#fff"
              opacity={opacity}
              r={3.5}
              stroke={color}
              strokeWidth={1.5}
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
        {displayLabel
? (
          <EdgeLabelRenderer>
            <span
              className={`redi-devtools__edge-label nodrag nopan${
                emphasized ? ' is-emphasized' : ''
              }${hovered ? ' is-hovered' : ''}`}
              data-redi-devtools-edge-label={id}
              style={{
                opacity: hovered || emphasized ? 1 : dimmed ? 0.15 : 0.82,
                transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
              }}
            >
              {displayLabel}
            </span>
          </EdgeLabelRenderer>
        )
: null}
      </>
    );
  },
);

const nodeTypes = {
  identifierGroup: IdentifierGroupNode,
  injector: InjectorNode,
  registration: RegistrationNode,
  terminal: TerminalNode,
};
const edgeTypes = { dependency: DependencyEdge };

function LegendSwatch({
  circle,
  color,
  dash,
  width = 1.5,
}: {
  readonly circle?: boolean;
  readonly color: string;
  readonly dash?: string;
  readonly width?: number;
}) {
  return (
    <svg aria-hidden="true" height="10" viewBox="0 0 30 10" width="30">
      <line
        stroke={color}
        strokeDasharray={dash}
        strokeWidth={width}
        x1="1"
        x2={circle ? 24 : 29}
        y1="5"
        y2="5"
      />
      {circle
? (
        <circle
          cx="26"
          cy="5"
          fill="#fff"
          r="3"
          stroke={color}
          strokeWidth="1.5"
        />
      )
: null}
    </svg>
  );
}

function Legend() {
  return (
    <details className="redi-devtools__legend">
      <summary>Legend</summary>
      <ul>
        <li>
          <LegendSwatch color="#64748b" />
          <span>depends on</span>
        </li>
        <li>
          <LegendSwatch color="#2563eb" width={2.4} />
          <span>selected resolution path</span>
        </li>
        <li>
          <LegendSwatch circle color="#9333ea" dash="3 4" />
          <span>alias (useExisting)</span>
        </li>
        <li>
          <LegendSwatch color="#7c3aed" dash="6 4" width={1.8} />
          <span>collapsed edges (× count)</span>
        </li>
        <li>
          <LegendSwatch color="#dc2626" width={1.8} />
          <span>unresolved requirement</span>
        </li>
        <li>
          <LegendSwatch color="#b6c2d4" width={2.5} />
          <span>parent → child Injector</span>
        </li>
      </ul>
    </details>
  );
}

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
    return (
      index.clusterById.get(edge.targetClusterId)?.label ?? edge.targetClusterId
    );
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
    return (
      <p className="redi-devtools__muted">
        Select an Injector or Registration.
      </p>
    );
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
              ? (index.clusterById.get(cluster.parentId)?.label ??
                cluster.parentId)
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
  layout: ReadonlyMap<
    string,
    Readonly<{ height: number; width: number; x: number; y: number }>
  >,
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
            identifierLabel: registration.identifierLabel,
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
        data: {
          label: node.terminalLabel ?? '',
          tone: node.terminalOutcome
            ? terminalTones[node.terminalOutcome]
            : 'muted',
        },
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
  // Smoothstep paths from nearby sources share the same turning lanes and
  // overlap; stagger the turn distance per source so parallel edges fan out.
  const laneBySource = new Map<string, number>();
  return canvasEdges.map((edge): FlowEdge => {
    if (edge.kind === 'structural') {
      return {
        data: {},
        id: edge.id,
        source: edge.source,
        sourceHandle: 'structure-source',
        style: { opacity: 0.75, stroke: '#b6c2d4', strokeWidth: 2.5 },
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
    const lane = laneBySource.get(edge.source) ?? 0;
    laneBySource.set(edge.source, lane + 1);
    const color = dependencyEdgeColor({
      aggregated: edge.aggregated,
      alias: edge.kind === 'alias',
      emphasized,
      ...(edge.outcome ? { outcome: edge.outcome } : {}),
    });
    return {
      data: {
        aggregated: edge.aggregated,
        alias: edge.kind === 'alias',
        color,
        count: edge.count,
        dimmed: hasRegistrationSelection && !emphasized,
        emphasized,
        hovered,
        hoverLabel: edge.hoverLabel ?? '',
        label: edge.label ?? '',
        onHover,
        onLeave,
        pathOffset: 18 + (lane % 4) * 10,
        ...(edge.outcome ? { outcome: edge.outcome } : {}),
      },
      id: edge.id,
      markerEnd: {
        color,
        height: 11,
        markerUnits: 'userSpaceOnUse',
        type: MarkerType.ArrowClosed,
        width: 11,
      },
      source: edge.source,
      ...(handles.sourceHandle ? { sourceHandle: handles.sourceHandle } : {}),
      target: edge.target,
      ...(handles.targetHandle ? { targetHandle: handles.targetHandle } : {}),
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

  // The `fitView` prop only applies on mount; re-fit whenever the graph
  // structure changes (collapse, discovery, new child Injectors) so fresh
  // content never lands outside the viewport. Deliberate centering wins.
  const fittedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!layout) return;
    if (fittedKeyRef.current === layout.structureKey) return;
    fittedKeyRef.current = layout.structureKey;
    if (pendingCenterId) return;
    const frame = window.requestAnimationFrame(() => {
      void flowRef.current?.fitView({
        duration: 320,
        maxZoom: 1,
        padding: 0.12,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layout, pendingCenterId]);

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
    setHoveredEdgeId((current) => (current === id ? null : current));
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
    () => (activeRootId ? rootTreeIds(model, activeRootId) : new Set<string>()),
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
        `${cluster.label} ${cluster.id}`
          .toLocaleLowerCase()
          .includes(normalized)
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
            placeholder="Search the Injector tree…"
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
        <button
          className="redi-devtools__toolbar-button"
          onClick={refresh}
          type="button"
        >
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
          {`${pluralize(activeClusterCount, 'injector', 'injectors')} · ${pluralize(
            activeEdgeCount,
            'dependency',
            'dependencies',
          )}${
            activePollInterval === null
              ? ' · polling off'
              : ` · polling ${activePollInterval}ms`
          }`}
        </span>
      </header>

      <div className="redi-devtools__body">
        <div className="redi-devtools__canvas" data-redi-devtools-canvas="">
          {!activeRootId
? (
            <div className="redi-devtools__empty">
              No live Injectors discovered.
            </div>
          )
: flowNodes.length === 0
? (
            <div className="redi-devtools__empty">
              Laying out Injector tree…
            </div>
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
              <MiniMap
                className="redi-devtools__minimap"
                maskColor="rgb(241 245 249 / 72%)"
                nodeBorderRadius={4}
                nodeColor={(node) =>
                  node.type === 'injector'
                    ? `${(node.data as InjectorNodeData).color}2e`
                    : node.type === 'identifierGroup'
                      ? '#e2e8f0'
                      : 'transparent'}
                nodeStrokeColor={(node) =>
                  node.type === 'injector'
                    ? (node.data as InjectorNodeData).color
                    : 'none'}
                nodeStrokeWidth={2}
                pannable
                position="bottom-right"
                zoomable
              />
              <Panel position="top-right">
                <Legend />
              </Panel>
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
                <GlyphIcon d={glyphs.close} />
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
