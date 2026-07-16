# 05 — Dependency Graph projection + Debugger Panel

**What to build:** Developers can mount a React Debugger Panel and see a live Dependency Graph: Injector Clusters for the whole hierarchy, Identifier Groups inside each cluster, Dependency Edges that follow Resolution Explain (including cross-cluster and missing/optional outcomes), and basic polling refresh — all without `get()` side effects.

**Blocked by:** 01 — Scaffold `@wendellhu/redi-devtools`; 03 — registration listing; 04 — Resolution Explain.

**Status:** ready-for-agent

- [ ] A React Debugger Panel component mounts at a developer-chosen location with no import-time enablement
- [ ] Graph shows Injector Clusters for parent/child hierarchy (hierarchy ≠ Dependency Edges)
- [ ] Same-Identifier Registrations are grouped; edges use Explain landings (cross-cluster allowed)
- [ ] Optional/required missing outcomes are visible as explicit edge results
- [ ] Graph refreshes by polling without instantiating dependencies
- [ ] Projector/Panel tests (or fixture-driven projector tests) cover groups, cross-cluster edges, and missing outcomes
