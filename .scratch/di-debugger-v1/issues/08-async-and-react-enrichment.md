# 08 — Async pending/loaded + React Discovery enrichment

**What to build:** Unloaded `useAsync` Registrations appear as pending without fake dependency edges; once loaded they expand like normal providers. React bindings may enrich Discovery with Provider-subtree hints so developers can relate Injectors to UI when that context exists.

**Blocked by:** 05 — Dependency Graph projection + Debugger Panel (React enrichment also relies on 02 — Injector Discovery registry).

**Status:** ready-for-agent

- [ ] Unloaded `useAsync` shows as pending Registration with no internal dependency edges
- [ ] After the async module is loaded, polling/projection expands edges like a normal provider
- [ ] React bindings can attach optional Discovery enrichment (e.g. Provider association) without being required for non-React usage
- [ ] Enrichment is visible or usable in the Debugger UI when present
- [ ] Tests cover async pending vs loaded and at least one React enrichment path
