import type {
  Injector,
  InjectorDebugProviderKind,
  InjectorDebugRegistrationStatus,
  InjectorDiscoveryMetadata,
  LookUp,
  Quantity,
} from '@wendellhu/redi';

export type GraphEdgeOutcome =
  | 'external'
  | 'injector'
  | 'many-empty'
  | 'optional-missing'
  | 'quantity-mismatch'
  | 'required-missing'
  | 'resolved';

export interface GraphDependency {
  readonly identifierLabel: string;
  readonly lookUp?: LookUp;
  readonly outcome: GraphEdgeOutcome;
  readonly quantity: Quantity;
  readonly targetClusterId: string | null;
  readonly targetGroupId: string | null;
  readonly targetRegistrationIds: readonly string[];
  readonly withNew: boolean;
}

export interface GraphRegistration {
  readonly debugId: string;
  readonly dependencies: readonly GraphDependency[];
  readonly dynamic?: boolean;
  readonly groupId: string;
  readonly id: string;
  readonly identifierLabel: string;
  readonly lazy?: boolean;
  readonly loadedProviderKind?: Exclude<
    InjectorDebugProviderKind,
    'async' | 'instance'
  >;
  readonly providerKind: InjectorDebugProviderKind;
  readonly providerLabel: string;
  readonly status: InjectorDebugRegistrationStatus;
}

export interface GraphGroup {
  readonly clusterId: string;
  readonly debugId: string;
  readonly id: string;
  readonly identifierLabel: string;
  readonly registrations: readonly GraphRegistration[];
}

export interface GraphCluster {
  readonly childIds: readonly string[];
  readonly discoveryId: number;
  readonly groups: readonly GraphGroup[];
  readonly id: string;
  readonly injector: Injector;
  readonly label: string;
  readonly metadata?: InjectorDiscoveryMetadata;
  readonly parentId: string | null;
  readonly rootId: string;
}

export interface GraphEdge {
  readonly id: string;
  readonly label: string;
  readonly lookUp?: LookUp;
  readonly outcome: GraphEdgeOutcome;
  readonly quantity: Quantity;
  readonly sourceClusterId: string;
  readonly sourceGroupId: string;
  readonly sourceRegistrationId: string;
  readonly targetClusterId: string | null;
  readonly targetGroupId: string | null;
  readonly targetRegistrationIds: readonly string[];
  readonly withNew: boolean;
}

export interface GraphModel {
  readonly clusters: readonly GraphCluster[];
  readonly edges: readonly GraphEdge[];
  readonly rootIds: readonly string[];
}
