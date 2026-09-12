# 09 — Discovery registry: weak refs + roots only

**Context:** Issue 02 shipped Discovery with `const liveInjectors = new Set<Injector>()`
(strong, module-global) and registered **every** Injector from the constructor
(`_attachLifecycle` → `registerInjectorForDiscovery(this, this.parent)`), removing
it only from `dispose()`. CONTEXT.md described this as "the core library always
keeps a lightweight registry of created Injectors".

**Problem found during the perf review (rebase onto `origin/main`):**

- The registry is a **strong** global `Set`, so any Injector that is created and
  dropped without `dispose()` is retained forever. Plain runtime (no devtools
  imported, no panel mounted) still pays for it, and `new Injector(...)` is not
  side-effect free with respect to GC.
- Both roots **and children** are top-level entries, so the registry grows with
  the whole forest, and `markInjectorDisposedForDiscovery` scans the full
  `liveInjectors` set on every dispose.
- Reproduced: after dropping all references and forcing GC, discovered injectors
  are still returned by `getInjectorDiscoverySnapshot()`.
- Benchmark impact (`new Injector(value registrations=100)`, no dispose):
  heap `+2.6MB` (main) → `+370MB` (branch); throughput ~4x slower. With explicit
  `dispose()` construction is still ~2x slower (per-registration registration
  object + discovery state).

**Decision (owner):** keep Discovery always-on, but:

1. **Weak references.** Store injectors as `WeakRef` and purge via
   `FinalizationRegistry`, so an injector that is garbage collected (without
   `dispose()`) leaves Discovery automatically.
2. **Roots only as entry points.** Only parentless injectors (and explicitly
   registered ones) are top-level entries. Children are linked weakly from the
   parent's discovery state and materialized by a DFS when building a snapshot.
   Explicit `registerInjectorForDiscovery(child, parent)` / ignore semantics must
   continue to work.

**Acceptance criteria**

- [x] `liveInjectors` (top-level) holds only roots + explicitly registered injectors
- [x] Registry holds `WeakRef`s; dropping all refs + GC removes undisposed injectors from snapshots
- [x] `getInjectorDiscoverySnapshot()` still reconstructs the full forest (children included) via weak child links
- [x] ignore/restore, explicit parent override, acyclic rejection, and dispose-tree tests all stay green
- [x] `markInjectorDisposedForDiscovery` no longer scans the whole top-level set

## Findings after implementation

Implemented in `src/injectorDiscovery.ts` + `Injector._attachLifecycle`:

- Top-level registry is now `Set<WeakRef<Injector>>`; children live in their
  parent's discovery state and are reached by DFS. The state is created lazily
  and `children` is created lazily on first link. No `FinalizationRegistry`:
  dead refs are swept lazily (`compactLiveInjectors` + snapshot traversal),
  because per-construction `register()` calls accumulate and caused severe GC
  pressure in cold benchmarks.
- Verified with a GC probe: after dropping all references and forcing GC, the
  Discovery snapshot drops to `0` (previously it stayed at `3`); retained heap
  is ~0 after GC. The previous `+370MB` growth on undisposed injectors is gone.
- **The discovery registry was NOT the dominant construction regression.** With
  the registry fixed, `primitives` is still ~-85% vs main. Isolated
  micro-benchmark of `new DependencyCollection(...)` alone is ~2x slower
  (`171k -> 84k ops/s` for 100 value registrations). The cost is the per-
  registration `DependencyRegistration` object plus eager `registration-N`
  string id added for debug registration identity — not Discovery.
- Resolution (`get()`) regressions are separate: `_wouldResolveAsync` calls
  `dependencyCollection.snapshot()` on every `get()` (O(N) allocation) and
  `_findResolutionTarget` runs 3x per `get`. Those are traced and fixed by a
  separate patch (see performance review), not by Discovery.

## Optimizations applied (same working tree)

Resolution hot path:

- `DependencyCollection.peek(id)` non-copying lookup; `_wouldResolveAsync` uses
  it instead of `snapshot().find(...)` (removes an O(N) allocation per `get`).
- `ResolvedDependencyCollection` stores a parallel `values` array; `get()` for
  `REQUIRED`/`OPTIONAL` returns the value directly and `MANY` returns the
  internal array, so no per-call copy.

Construction / registration identity:

- Registration ids are numeric (`registrationId`), not `registration-N`
  strings.
- Removed the per-registration `DependencyRegistration` wrapper object;
  `DependencyCollection` now keeps a parallel `ids` array per Identifier
  (append-only), which preserves globally unique, stable ids across
  delete/replace while avoiding an allocation per registration.
- Async dedup maps are keyed by `(identifier, registrationId)` instead of the
  wrapper object.

Median-of-3 group benchmark vs `origin/main` after these changes:

- `resolve :: cold alias chain (depth=50)` -94% -> **-10%**
- `variants:many :: hot MANY` -52% -> **+4%**
- `variants:factory :: hot factory` -34% -> **+16%**
- `resolve :: hot alias` -33% -> **-8%**, `resolve :: hot class` -25% -> **-12%**
- 7 cases >15% faster, 6 still >15% slower (`primitives` only + one lazy case)

Remaining: `primitives` construction is still ~-80% in the no-dispose
benchmark. Isolated: with Discovery stubbed out, `new Injector` is ~1.35x main
(down from ~4x); the rest is the cost of eagerly creating one `WeakRef` +
state per root and the GC weak-reference bookkeeping. That is inherent to the
"always register, weak" choice and is negligible for realistic injector counts
(a handful per app), but it dominates a benchmark that builds millions of
injectors. Making registration opt-in (only when a Discovery consumer is
active) would remove it entirely; deferred.
