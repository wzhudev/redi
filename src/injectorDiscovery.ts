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
  readonly injector: Injector;
  parent: InjectorDiscoveryState | null;
  /** Weakly linked children, created lazily on first link. */
  children: Set<WeakRef<Injector>> | null;
  readonly ref: WeakRef<Injector>;
}

interface MutableInjectorDiscoveryRecord {
  readonly id: number;
  readonly injector: Injector;
  parent: InjectorDiscoveryRecord | null;
  children: MutableInjectorDiscoveryRecord[];
  readonly metadata?: InjectorDiscoveryMetadata;
}

/**
 * Top-level Discovery entry points: root Injectors plus any Injector a
 * developer explicitly registered. Children are linked from their parent's
 * state (see `linkInjectorForDiscovery`) and materialized on snapshot, so the
 * registry never grows with the whole forest.
 *
 * Every reference here is weak: an Injector that is dropped without being
 * disposed can be garbage collected. Dead `WeakRef`s are swept lazily by
 * `compactLiveInjectors` / snapshot traversal, so no finalization callbacks or
 * per-construction bookkeeping are needed.
 */
const liveInjectors = new Set<WeakRef<Injector>>();
const stateByInjector = new WeakMap<Injector, InjectorDiscoveryState>();
const ignoredInjectors = new WeakSet<Injector>();
const disposedInjectors = new WeakSet<Injector>();
const metadataByInjector = new WeakMap<Injector, InjectorDiscoveryMetadata>();

let nextInjectorId = 1;

function addTopLevel(state: InjectorDiscoveryState): void {
  liveInjectors.add(state.ref);

  // Opportunistically sweep refs whose Injector has been collected, so a
  // long-lived process that creates and drops many roots does not grow the
  // set without bound even if Discovery is never read.
  if (liveInjectors.size >= 1024 && liveInjectors.size % 512 === 0) {
    compactLiveInjectors();
  }
}

/** Drop top-level entries whose Injector has been garbage collected. */
function compactLiveInjectors(): void {
  for (const ref of liveInjectors) {
    if (!ref.deref()) {
      liveInjectors.delete(ref);
    }
  }
}

function isDiscoverableParent(parentState: InjectorDiscoveryState): boolean {
  return !parentState.disposed && !ignoredInjectors.has(parentState.injector);
}

function assertAcyclicParent(
  injector: Injector,
  parent: Injector | null,
): void {
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

/**
 * Create or update the discovery state for `injector`.
 *
 * - `parent === undefined` preserves the existing relationship.
 * - `parent === null` clears it.
 * - a live Injector links `injector` under `parent`'s state.
 */
function getOrCreateState(
  injector: Injector,
  parent?: Injector | null,
): InjectorDiscoveryState {
  let state = stateByInjector.get(injector);

  if (!state) {
    state = {
      children: null,
      disposed: false,
      id: nextInjectorId,
      injector,
      parent: null,
      ref: new WeakRef(injector),
    };
    nextInjectorId += 1;
    stateByInjector.set(injector, state);

    if (parent !== undefined && parent !== null) {
      const parentState = getOrCreateState(parent);
      state.parent = parentState;
      (parentState.children ??= new Set()).add(state.ref);
    }

    return state;
  }

  if (parent !== undefined) {
    if (state.parent) {
      state.parent.children?.delete(state.ref);
    }

    const parentState = parent ? getOrCreateState(parent) : null;
    state.parent = parentState;
    if (parentState) {
      (parentState.children ??= new Set()).add(state.ref);
    }
  } else if (state.parent?.disposed) {
    state.parent.children?.delete(state.ref);
    state.parent = null;
  }

  return state;
}

/**
 * Explicitly include an Injector in Discovery as a top-level entry point.
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

  const state = getOrCreateState(injector, parent);
  ignoredInjectors.delete(injector);
  addTopLevel(state);
  return true;
}

/**
 * Link a child Injector into Discovery without making it a top-level entry
 * point. Children are materialized by walking the forest on snapshot, so the
 * top-level registry only ever holds roots and explicit registrations.
 *
 * @internal
 */
export function linkInjectorForDiscovery(
  injector: Injector,
  parent: Injector,
): void {
  if (disposedInjectors.has(injector)) {
    return;
  }

  getOrCreateState(injector, parent);
}

/**
 * Explicitly exclude a live Injector from Discovery without disposing it.
 * Its stable id, relationship, and metadata are retained weakly so that a
 * later explicit registration can restore the same record identity. Its
 * children surface as roots while it is ignored.
 *
 * @returns `true` when a discovered Injector was removed.
 */
export function ignoreInjectorForDiscovery(injector: Injector): boolean {
  if (disposedInjectors.has(injector) || ignoredInjectors.has(injector)) {
    return false;
  }

  if (!stateByInjector.has(injector)) {
    return false;
  }

  ignoredInjectors.add(injector);
  return true;
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
 * Top-level roots are walked first, then each state's weakly linked children.
 * Ignored Injectors are omitted; their descendants surface as roots until the
 * ignored Injector is registered again. Reading Discovery never resolves or
 * instantiates a dependency.
 */
export function getInjectorDiscoverySnapshot(): InjectorDiscoverySnapshot {
  const records: MutableInjectorDiscoveryRecord[] = [];
  const visited = new Set<InjectorDiscoveryState>();

  const visit = (
    injector: Injector,
    parentRecord: MutableInjectorDiscoveryRecord | null,
  ): void => {
    if (disposedInjectors.has(injector)) {
      return;
    }

    const state = getOrCreateState(injector);
    if (visited.has(state)) {
      return;
    }
    visited.add(state);

    if (ignoredInjectors.has(injector)) {
      for (const childRef of state.children ?? []) {
        const child = childRef.deref();
        if (child) {
          visit(child, null);
        } else {
          state.children?.delete(childRef);
        }
      }
      return;
    }

    const metadata = metadataByInjector.get(injector);
    const record: MutableInjectorDiscoveryRecord = {
      children: [],
      id: state.id,
      injector,
      parent: parentRecord,
      ...(metadata ? { metadata } : {}),
    };
    records.push(record);
    if (parentRecord) {
      parentRecord.children.push(record);
    }

    for (const childRef of state.children ?? []) {
      const child = childRef.deref();
      if (child) {
        visit(child, record);
      } else {
        state.children?.delete(childRef);
      }
    }
  };

  // Roots and orphans first. A top-level Injector whose discovery parent is
  // itself discoverable is skipped here; it will be reached while walking that
  // parent. A second pass picks up anything left unreachable.
  for (const ref of liveInjectors) {
    const injector = ref.deref();
    if (!injector) {
      liveInjectors.delete(ref);
      continue;
    }

    const state = stateByInjector.get(injector);
    if (state?.parent && isDiscoverableParent(state.parent)) {
      continue;
    }

    visit(injector, null);
  }

  for (const ref of liveInjectors) {
    const injector = ref.deref();
    if (injector) {
      visit(injector, null);
    }
  }

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
 * Its weakly linked children lose their parent and become top-level entries so
 * they stay discoverable as roots.
 *
 * @internal
 */
export function markInjectorDisposedForDiscovery(injector: Injector): void {
  const state = stateByInjector.get(injector);
  if (state) {
    liveInjectors.delete(state.ref);
    state.parent?.children?.delete(state.ref);
    state.disposed = true;

    for (const childRef of state.children ?? []) {
      const child = childRef.deref();
      if (!child) {
        continue;
      }

      const childState = stateByInjector.get(child);
      if (childState && childState.parent === state) {
        childState.parent = null;
        addTopLevel(childState);
      }
    }
  }

  ignoredInjectors.delete(injector);
  metadataByInjector.delete(injector);
  disposedInjectors.add(injector);
}
