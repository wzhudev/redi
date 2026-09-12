# Spec: DI Debugger v1 (Dependency Graph)

Status: Implemented (2026-07-16)
Related: [CONTEXT.md](../../CONTEXT.md), [ADR 0001](../adr/0001-separate-debugger-package.md)–[0006](../adr/0006-injector-tree-visualization.md)

## Problem Statement

Developers using redi can register complex Injector hierarchies (parent/child overrides, `@Many()`, aliases, lazy and async providers), but they have no visual way to see what is registered and how runtime resolution would connect those registrations. Reading registration arrays and calling `get()` by hand is slow, easy to misread, and can change application state (for example by instantiating lazy dependencies). They need a developer-facing DI Debugger that shows the live Dependency Graph without disturbing the system under observation.

## Solution

Ship a React-based DI Debugger in `@wendellhu/redi-devtools`. Developers mount a Debugger Panel component or call a setup function that auto-mounts a Debugger Overlay. The UI shows one Active Root Tree at a time. Each Injector is an independent compound node connected to child Injectors by structural tree connectors; it contains Identifier Groups, which contain the Injector's Registrations. Resolution-aware Dependency Edges connect concrete Registrations within or across Injector boundaries. Core `@wendellhu/redi` always keeps a lightweight Injector Discovery registry and exposes tooling APIs under `injector.debug` (including Resolution Explain) so the graph can be built as a read-only projection without calling `get()`.

## User Stories

1. As an application developer, I want to install a separate debugger package, so that my production bundle does not carry debugger UI by default.
2. As an application developer, I want importing the debugger package to do nothing by itself, so that I never enable tooling through accidental side effects.
3. As an application developer, I want a React Debugger Panel component I can mount anywhere, so that I can embed the debugger in my own debug page or layout.
4. As an application developer, I want a setup function that auto-mounts a Debugger Overlay, so that I can open the debugger quickly without wiring UI myself.
5. As an application developer, I want Overlay and Panel to show the same Dependency Graph surface, so that I do not learn two different tools.
6. As an application developer using redi without React in most of the app, I still want the v1 debugger to work if I can mount a React shell, so that I am not blocked solely by non-React UI code elsewhere.
7. As an application developer, I want every created Injector to be discoverable even if I open the debugger later, so that early bootstrap injectors are not missing.
8. As an application developer, I want disposed Injectors to leave Discovery, so that the graph does not show dead containers.
9. As an application developer, I want to explicitly register or ignore an Injector, so that I can correct Discovery in unusual setups.
10. As an application developer using React bindings, I want Injectors from Redi context / `connectDependencies` to be enrichable with UI-tree hints, so that I can tell which Provider subtree an Injector belongs to when that information exists.
11. As an application developer, I want the Dependency Graph to show one complete root Injector tree on one canvas, so that I can understand overrides and cross-layer links without switching a “current injector.”
12. As an application developer, I want each Injector drawn as an independent compound node connected to its children, so that ownership is obvious without geometrically nesting child Injectors inside parents.
13. As an application developer, I want registrations for the same Identifier inside one Injector grouped together, so that `@Many()` and multiple bindings stay coherent.
14. As an application developer, I want Registration cards to show provider kind (`useClass`, `useValue`, `useFactory`, `useExisting`, `useAsync`) and options such as lazy, so that I can see how something is provided.
15. As an application developer, I want Registration cards to show creation status (created / not created / pending async), so that I know what has already been instantiated without forcing creation.
16. As an application developer, I want Dependency Edges to match runtime resolution including `@Self()`, `@SkipSelf()`, `@Optional()`, and `@Many()`, so that the graph does not lie about where a dependency would come from.
17. As an application developer, I want optional-missing and required-missing outcomes to be visible as explicit edge outcomes, so that “no link” is not confused with a drawing bug.
18. As an application developer, I want alias registrations (`useExisting`) to show edges to the concrete resolved Registration, so that aliases are understandable.
19. As an application developer, I want unloaded `useAsync` registrations marked pending without fake dependency edges, so that incomplete async state is honest.
20. As an application developer, I want loaded `useAsync` modules expanded like normal providers once available, so that async dependencies become inspectable after load.
21. As an application developer, I want parent/child relationships shown as thick neutral structural connectors without dependency arrowheads, so that scope and injection are not visually conflated.
22. As an application developer with multiple unrelated root Injectors, I want a top toolbar switch containing only parentless Injectors, so that I can show one complete tree at a time.
23. As an application developer with a large active tree, I want to center any Injector without changing the active root and search within the active tree, so that the graph stays navigable.
24. As an application developer, I want the graph to refresh by polling in v1, so that add/replace/child/dispose/instantiation changes eventually appear without event instrumentation.
25. As an application developer, I want inspecting the graph never to call `get()` or instantiate dependencies, so that observation does not change program behavior.
26. As a tooling author, I want Resolution Explain and related helpers under `injector.debug`, so that I can build accurate graphs without using business `get` APIs.
27. As an application developer, I want `injector.debug` to look clearly non-business, so that teammates are discouraged from using it in product logic.
28. As a library maintainer, I want runtime resolution to stay recursive for v1, so that shipping the debugger does not require rewriting the Injector engine.
29. As a library maintainer, I want Explain lookup to share the same find-registration rules as create/get, so that graph edges and runtime stay aligned.
30. As a future Node.js user, I accept that v1 has no HTTP remote shell, so that the first release can focus on in-process React debugging.
31. As a future user of Resolution Trace, I accept that lifecycle timelines are out of v1, so that structure lands first.
32. As an application developer, I want pan, zoom, and fit-to-view controls, so that big hierarchies remain navigable.
33. As an application developer, I want readable labels for Identifiers (pretty names for classes and `createIdentifier` tokens), so that the graph is scannable.
34. As an application developer, I want to select an Injector or Registration and see details, so that the canvas need not show every attribute at once.
35. As a library maintainer, I want core Discovery bookkeeping to be cheap and correct across create/dispose, so that apps that never install devtools still stay safe.

## Implementation Decisions

### Packages and delivery

- Add npm package `@wendellhu/redi-devtools` (Debugger Package), separate from `@wendellhu/redi` (ADR 0001).
- Prefer same monorepo workspace packaging so core and devtools can develop together; publish as distinct package names.
- Devtools depends on `@wendellhu/redi` and React (peer or direct per repo norms for `react-bindings`).
- No enablement on import. Public UI entrypoints:
  - Debugger Panel: React component for custom mount.
  - Setup function: creates a host DOM node (if needed) and mounts the same UI as Overlay.
- v1 Debugger Shell is React-only (ADR glossary: Debugger Shell).

### Core: Injector Discovery

- Core always maintains a lightweight global registry of live Injectors (ADR 0002).
- Register on Injector construction; unregister on dispose; preserve parent/child links already known to Injector so the forest can be reconstructed.
- Avoid retaining disposed Injectors (do not leak).
- Support explicit register / ignore for unusual cases.
- React bindings may attach optional enrichment metadata (e.g. association with a Provider subtree) when available; enrichment is additive, not required for Discovery.

### Core: `injector.debug` tooling namespace

- Expose a `debug` object on Injector for tooling (not business API).
- Minimum capabilities needed to build the Dependency Graph projection:
  - List registrations in this Injector (Identifier → Registration descriptors), suitable for Identifier Groups.
  - Read creation / pending status per Registration without instantiating.
  - Resolution Explain: given identifier + quantity + lookUp (and withNew if relevant to targeting), return where lookup would land — which Injector(s) and Registration(s), or explicit empty/missing outcomes — without calling `get()` or running factories/constructors (ADR 0003, ADR 0004).
  - Access parent/children as needed for cluster hierarchy (may reuse existing structure via debug helpers or registry).
- Prefer sharing the find-registration control flow with `createDependency` / equivalent, parameterized so “explain” stops before instantiate (ADR 0005).
- Also expose a module-level or debug helper to read the global Discovery registry for Overlay/Panel bootstrap.

### Graph model (devtools)

- Build the Dependency Graph as a periodic read-only projection (ADR 0005):
  1. Read Discovery forest.
  2. Enumerate Registrations per Injector Cluster.
  3. Group by Identifier → Identifier Groups.
  4. For each Registration, collect declared dependency descriptors (`getDependencies` / factory deps / `useExisting`).
  5. Run Resolution Explain from the owning Injector for each descriptor to choose edge targets.
- One canvas shows the complete Active Root Tree; Injector Clusters are separate compound nodes connected by parent/child structural edges and never nest inside one another.
- Multiple roots → root-only toolbar switch; only one root tree is rendered at a time.
- Dependency Edges are resolution outcomes, not merely “declared token” links.
- Parent/child links are hierarchy among clusters, never Dependency Edges; outer tree layout has priority over shortening cross-Injector dependency routes.
- `useAsync`: pending if unloaded (no internal edges); expand like a normal provider once loaded.
- v1 refresh: polling interval (configurable via setup/Panel props is desirable); event-driven refresh deferred until Resolution Trace.

### UI (devtools)

- Shared surface for Overlay and Panel.
- Primary view: a top-down compound Dependency Graph. Independent Injector nodes contain Identifier Groups, and Identifier Groups contain concrete Registration nodes.
- Dependency Edges land on concrete Registration nodes. Missing/special outcomes use labeled terminal edges rather than fake nodes.
- Supporting chrome: root-only switch, active-tree search, manual refresh, pan/zoom/fit, selection details, explicit per-Injector center action, and independent contents/subtree collapse controls.
- Root switching initially expands the complete tree and all Registration contents; collapse state is temporary and is not persisted.
- Collapsed contents/subtrees aggregate crossing dependency edges at the visible Injector boundary with incoming/outgoing counts.
- All Dependency Edges remain visible at low contrast. Selecting a Registration highlights its transitive outgoing dependency closure plus its direct incoming dependencies.
- Injector ownership uses stable color plus text. Injector structural connectors are thicker, neutral, and arrowless; Dependency Edges are thinner and directed.
- Exact graph library choice is an implementation detail; it must support multi-level compound nodes, constrained top-down tree layout, cross-container edge routing, pan/zoom, and graphs at the scale of real apps (e.g. Univer-sized trees).

### Compatibility and versioning

- `injector.debug` is a compatibility surface between `@wendellhu/redi` and `@wendellhu/redi-devtools`; document semver expectations (devtools may require a minimum core version).
- Do not require a serializable wire protocol in v1.

## Testing Decisions

### What good tests look like

- Assert observable behavior at seams: Discovery contents, Explain outcomes, projected graph structure, and UI mount contracts.
- Do not assert private recursion structure inside Injector beyond what Explain exposes.
- Prefer parity tests: for a fixture Injector tree, Explain landings must match where a subsequent real `get()` would have taken instances from (without using `get()` inside Explain itself). Where `get()` would instantiate, tests may `get()` only in the assertion lane after Explain was already computed, or compare against known registration locations.

### Primary seam (preferred single high seam)

**Resolution Explain + registration listing on `injector.debug`, plus the Discovery registry.**

This is the highest-value seam: if Explain and listing are correct, the Dependency Graph projection is mostly deterministic mapping; UI can be tested thinner.

Secondary seams (only where needed):

- Devtools graph projector: pure function from debug snapshots → graph view-model (clusters, groups, edges, pending/missing).
- Panel/Overlay mount: renders without side-effect import; setup mounts and unmounts cleanly.

### What to test in core

- Registry add on construct, remove on dispose, parent/child forest shape, explicit ignore/register.
- Explain for SELF / SKIP_SELF / default parent walk / OPTIONAL empty / MANY / overrides in child / `useExisting` chains.
- Explain never instantiates lazy providers (creation status stays uncreated after explain + poll).
- `useAsync` pending vs loaded listing behavior as exposed by debug APIs.

### What to test in devtools

- Projector maps fixtures to expected Identifier Groups, cross-cluster edges, missing optional outcomes, async pending nodes.
- Panel and setup/Overlay mount APIs (React testing patterns already used for `react-bindings`).

### Prior art

- Core tests under `src/__tests__` with `bun:test`, hierarchical injector fixtures, decorator lookup cases.
- React binding tests with happy-dom / Testing Library for mount behavior.

## Out of Scope

- Resolution Trace / lifecycle flame graphs (v2).
- Event-driven graph refresh (planned with Trace).
- Rewriting runtime resolution to a graph-based engine.
- Browser extension shell.
- Node.js HTTP remote debugger / serializable snapshot protocol.
- Non-React Debugger Shell in v1.
- Using real `get()` to populate the graph.
- Treating `injector.debug` as a recommended application-layer DI API.
- Pixel-perfect design system work beyond a usable developer tool.
- Guaranteeing production no-op if someone mounts the debugger in production (docs may warn; hard block optional later).

## Further Notes

- Domain vocabulary lives in `CONTEXT.md`; keep code and UI copy aligned with those terms where practical (English API names, glossary bilingual titles are fine in docs).
- ADR 0001’s earlier phrasing about an “opt-in-only” core hook is superseded for Discovery by ADR 0002 (always-on lightweight registry). UI remains in the separate package.
- Suggested implementation order: (1) Discovery registry + dispose correctness, (2) `injector.debug` listing + Explain with parity tests, (3) graph projector, (4) Panel, (5) Overlay setup, (6) React enrichment, (7) polish filter/selection/polling options.
- Default poll interval can be chosen at implementation time; expose override on setup/Panel.
- Package may live as a workspace package (e.g. `packages/redi-devtools`) or sibling folder; choose whatever fits current release tooling with least friction, as long as the published name is `@wendellhu/redi-devtools`.
