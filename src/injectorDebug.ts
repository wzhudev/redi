import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Injector } from './injector';
import type { LookUp, Quantity } from './types';

/** Provider categories exposed to developer tooling. */
export type InjectorDebugProviderKind =
  | 'async'
  | 'class'
  | 'existing'
  | 'factory'
  | 'instance'
  | 'value';

/** Creation state observed without resolving the registration. */
export type InjectorDebugRegistrationStatus =
  | 'created'
  | 'not-created'
  | 'pending';

/** A normalized dependency declared by a registration. */
export interface InjectorDebugDependencyDescriptor {
  readonly identifier: DependencyIdentifier<unknown>;
  readonly identifierLabel: string;
  readonly lookUp?: LookUp;
  readonly paramIndex: number;
  readonly quantity: Quantity;
  readonly withNew: boolean;
}

/** A side-effect-free description of one registration. */
export interface InjectorDebugRegistration {
  /** Stable for the lifetime of this registration in its owning Injector. */
  readonly id: string;
  readonly dependencies: readonly InjectorDebugDependencyDescriptor[];
  readonly dynamic?: boolean;
  readonly identifier: DependencyIdentifier<unknown>;
  readonly identifierLabel: string;
  readonly lazy?: boolean;
  /** The provider exposed by a resolved async loader, when known. */
  readonly loadedProviderKind?: Exclude<
    InjectorDebugProviderKind,
    'async' | 'instance'
  >;
  readonly providerKind: InjectorDebugProviderKind;
  readonly providerLabel: string;
  readonly status: InjectorDebugRegistrationStatus;
}

/** Registrations sharing an Identifier inside one Injector. */
export interface InjectorDebugIdentifierGroup {
  /** Stable for the lifetime of this Identifier in its owning Injector. */
  readonly id: string;
  readonly identifier: DependencyIdentifier<unknown>;
  readonly identifierLabel: string;
  readonly registrations: readonly InjectorDebugRegistration[];
}

/** Input accepted by side-effect-free Resolution Explain. */
export interface InjectorDebugResolutionRequest<T = unknown> {
  readonly identifier: DependencyIdentifier<T>;
  readonly lookUp?: LookUp;
  readonly quantity?: Quantity;
  readonly withNew?: boolean;
}

/** Normalized request repeated on every Explain result. */
export interface NormalizedInjectorDebugResolutionRequest<T = unknown> {
  readonly identifier: DependencyIdentifier<T>;
  readonly lookUp?: LookUp;
  readonly quantity: Quantity;
  readonly withNew: boolean;
}

/** The registration location runtime resolution would select. */
export interface InjectorDebugResolutionLanding {
  readonly groupId: string;
  readonly injector: Injector;
  readonly registrationIds: readonly string[];
  /** Built-ins do not have a normal Registration card. */
  readonly synthetic?: 'injector';
}

interface InjectorDebugResolutionBase<T> {
  readonly request: NormalizedInjectorDebugResolutionRequest<T>;
}

export interface InjectorDebugResolved<
  T,
> extends InjectorDebugResolutionBase<T> {
  readonly landing: InjectorDebugResolutionLanding;
  readonly outcome: 'resolved';
}

export interface InjectorDebugMissing<
  T,
> extends InjectorDebugResolutionBase<T> {
  readonly landing: null;
  readonly outcome: 'many-empty' | 'optional-missing' | 'required-missing';
}

export interface InjectorDebugQuantityMismatch<
  T,
> extends InjectorDebugResolutionBase<T> {
  readonly actual: number;
  readonly landing: InjectorDebugResolutionLanding;
  readonly outcome: 'quantity-mismatch';
}

/** Explicit, non-throwing result of Resolution Explain. */
export type InjectorDebugResolution<T = unknown> =
  | InjectorDebugMissing<T>
  | InjectorDebugQuantityMismatch<T>
  | InjectorDebugResolved<T>;

/** Tooling-only, side-effect-free APIs attached to every Injector. */
export interface InjectorDebugApi {
  readonly explain: <T>(
    request: InjectorDebugResolutionRequest<T>,
  ) => InjectorDebugResolution<T>;
  readonly listRegistrations: () => readonly InjectorDebugIdentifierGroup[];
}
