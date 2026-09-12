# 05 — Dependency Graph projection + Debugger Panel

**What to build:** Developers can mount a React Debugger Panel and see a live compound Dependency Graph: one root Injector tree at a time, separate Injector nodes connected by structural edges, Identifier Groups and Registration nodes inside each Injector, resolution-aware Registration-to-Registration edges, and polling refresh — all without `get()` side effects. See ADR 0006.

**Blocked by:** 01 — Scaffold `@wendellhu/redi-devtools`; 03 — registration listing; 04 — Resolution Explain.

**Status:** implemented

- [x] A React Debugger Panel component mounts at a developer-chosen location with no import-time enablement
- [x] Graph shows separate compound Injector nodes in a stable top-down tree (hierarchy ≠ Dependency Edges)
- [x] Same-Identifier Registrations are grouped inside their owning Injector; edges land on concrete Explain-selected Registrations (cross-Injector allowed)
- [x] Optional/required missing outcomes are visible as explicit edge results
- [x] Graph refreshes by polling without instantiating dependencies
- [x] Panel tests cover root switching, compound containment, centering, collapse aggregation, selection highlighting, and navigation controls
