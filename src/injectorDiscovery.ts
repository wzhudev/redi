import type { Injector } from './injector';

/**
 * Optional, tooling-owned information associated with an Injector.
 *
 * Core does not interpret these values. Integrations such as the React
 * bindings can use them to add context to Discovery snapshots.
 */
export type InjectorDiscoveryMetadata = Readonly<Record<string, unknown>>;

/**
 * A point-in-time view of one live Injector in the Discovery forest.
 *
 * The record and its relationship arrays are immutable. `id` remains stable
 * for the lifetime of an Injector, including across ignore/register cycles.
 */
export interface InjectorDiscoveryRecord {
  readonly id: number;
  readonly injector: Injector;
  readonly parent: InjectorDiscoveryRecord | null;
  readonly children: readonly InjectorDiscoveryRecord[];
  readonly metadata?: InjectorDiscoveryMetadata;
}

/** A point-in-time, immutable view of all discovered live Injectors. */
export interface InjectorDiscoverySnapshot {
  readonly records: readonly InjectorDiscoveryRecord[];
  readonly roots: readonly InjectorDiscoveryRecord[];
}

interface InjectorDiscoveryState {
  disposed: boolean;
  readonly id: number;
  parent: InjectorDiscoveryState | null;
}

interface MutableInjectorDiscoveryRecord {
  readonly id: number;
  readonly injector: Injector;
  parent: InjectorDiscoveryRecord | null;
  children: InjectorDiscoveryRecord[];
  readonly metadata?: InjectorDiscoveryMetadata;
}

const liveInjectors = new Set<Injector>();
const ignoredInjectors = new WeakSet<Injector>();
const disposedInjectors = new WeakSet<Injector>();
const stateByInjector = new WeakMap<Injector, InjectorDiscoveryState>();
const metadataByInjector = new WeakMap<Injector, InjectorDiscoveryMetadata>();

let nextInjectorId = 1;

function assertAcyclicParent(injector: Injector, parent: Injector | null): void {
  const injectorState = getOrCreateState(injector);
  const visited = new Set<InjectorDiscoveryState>();
  let current = parent ? getOrCreateState(parent) : null;

  while (current) {
    if (current.disposed) {
      throw new TypeError(
        'Injector Discovery parents must be live Injector instances.',
      );
    }
    if (current === injectorState || visited.has(current)) {
      throw new TypeError(
        'Injector Discovery parent relationships must form an acyclic forest.',
      );
    }

    visited.add(current);
    current = current.parent;
  }
}

function getOrCreateState(
  injector: Injector,
  parent?: Injector | null,
): InjectorDiscoveryState {
  let state = stateByInjector.get(injector);

  if (!state) {
    state = {
      disposed: false,
      id: nextInjectorId,
      parent: parent ? getOrCreateState(parent) : null,
    };
    nextInjectorId += 1;
    stateByInjector.set(injector, state);
  } else if (parent !== undefined) {
    state.parent = parent ? getOrCreateState(parent) : null;
  } else if (state.parent?.disposed) {
    state.parent = null;
  }

  return state;
}

/**
 * Explicitly include an Injector in Discovery.
 *
 * Passing a parent overrides the relationship remembered by automatic
 * construction-time registration. Omitting it preserves that relationship.
 * A disposed Injector can never be registered again.
 *
 * @returns `true` when the Injector is discoverable, or `false` when it has
 * already been disposed.
 */
export function registerInjectorForDiscovery(
  injector: Injector,
  parent?: Injector | null,
): boolean {
  if (disposedInjectors.has(injector)) {
    return false;
  }

  if (parent !== undefined) {
    assertAcyclicParent(injector, parent);
  }

  getOrCreateState(injector, parent);
  ignoredInjectors.delete(injector);
  liveInjectors.add(injector);
  return true;
}

/**
 * Explicitly exclude a live Injector from Discovery without disposing it.
 * Its stable id, relationship, and metadata are retained weakly so that a
 * later explicit registration can restore the same record identity.
 *
 * @returns `true` when a discovered Injector was removed.
 */
export function ignoreInjectorForDiscovery(injector: Injector): boolean {
  if (disposedInjectors.has(injector)) {
    return false;
  }

  ignoredInjectors.add(injector);
  return liveInjectors.delete(injector);
}

/**
 * Replace the optional Discovery metadata for an Injector.
 *
 * Metadata is copied and frozen so callers cannot mutate a published
 * snapshot through an object they still own. It may be prepared while an
 * Injector is ignored and will become visible if that Injector is registered
 * again.
 *
 * @returns `false` when the Injector has already been disposed.
 */
export function setInjectorDiscoveryMetadata(
  injector: Injector,
  metadata: InjectorDiscoveryMetadata | undefined,
): boolean {
  if (disposedInjectors.has(injector)) {
    return false;
  }

  if (metadata === undefined) {
    metadataByInjector.delete(injector);
  } else {
    metadataByInjector.set(injector, Object.freeze({ ...metadata }));
  }

  return true;
}

/**
 * Shallowly merge optional tooling metadata into an Injector's Discovery
 * record without changing unrelated enrichment fields.
 *
 * @returns `false` when the Injector has already been disposed.
 */
export function mergeInjectorDiscoveryMetadata(
  injector: Injector,
  metadata: InjectorDiscoveryMetadata,
): boolean {
  if (disposedInjectors.has(injector)) {
    return false;
  }

  const current = metadataByInjector.get(injector);
  metadataByInjector.set(
    injector,
    Object.freeze({ ...(current ?? {}), ...metadata }),
  );
  return true;
}

/**
 * Read an Injector's immutable enrichment metadata without changing whether
 * it is currently visible in Discovery. This also works for ignored Injectors.
 */
export function getInjectorDiscoveryMetadata(
  injector: Injector,
): InjectorDiscoveryMetadata | undefined {
  return metadataByInjector.get(injector);
}

/**
 * Read all currently discovered Injectors as an immutable forest snapshot.
 *
 * Ignored Injectors are omitted. If an Injector's direct parent is ignored,
 * that Injector becomes a root until the parent is registered again.
 * Reading Discovery never resolves or instantiates a dependency.
 */
export function getInjectorDiscoverySnapshot(): InjectorDiscoverySnapshot {
  const mutableRecords = new Map<Injector, MutableInjectorDiscoveryRecord>();
  const recordsByState = new Map<
    InjectorDiscoveryState,
    MutableInjectorDiscoveryRecord
  >();

  for (const injector of liveInjectors) {
    const state = getOrCreateState(injector);
    const metadata = metadataByInjector.get(injector);
    const record: MutableInjectorDiscoveryRecord = {
      id: state.id,
      injector,
      parent: null,
      children: [],
      ...(metadata ? { metadata } : {}),
    };
    mutableRecords.set(injector, record);
    recordsByState.set(state, record);
  }

  for (const [injector, record] of mutableRecords) {
    const parentState = stateByInjector.get(injector)?.parent;
    const parentRecord = parentState ? recordsByState.get(parentState) : undefined;

    if (parentRecord) {
      record.parent = parentRecord;
      parentRecord.children.push(record);
    }
  }

  const records = Array.from(mutableRecords.values());
  for (const record of records) {
    Object.freeze(record.children);
    Object.freeze(record);
  }

  return Object.freeze({
    records: Object.freeze([...records]),
    roots: Object.freeze(records.filter((record) => record.parent === null)),
  });
}

/**
 * Remove an Injector from Discovery permanently as part of its disposal.
 *
 * @internal
 */
export function markInjectorDisposedForDiscovery(injector: Injector): void {
  liveInjectors.delete(injector);
  const disposedState = stateByInjector.get(injector);
  if (disposedState) {
    disposedState.disposed = true;
    for (const liveInjector of liveInjectors) {
      const state = stateByInjector.get(liveInjector);
      if (state?.parent === disposedState) {
        state.parent = null;
      }
    }
  }
  ignoredInjectors.delete(injector);
  metadataByInjector.delete(injector);
  disposedInjectors.add(injector);
}
