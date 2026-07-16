# Domain Glossary

Canonical vocabulary for redi. Domain terms only — no implementation details.

## Dependency Graph (依赖关系图)

A structural view of an Injector hierarchy and how registrations relate. One graph shows the whole parent/child tree at once — not one Injector at a time. Each Injector appears as a cluster/partition containing its own Identifier Groups and Registrations. The first version refreshes this view by periodic polling; event-driven refresh is deferred until Resolution Trace work lands.

## Identifier Group (Identifier 分组)

The primary registration unit inside an Injector cluster: all Registrations for the same Identifier _in that Injector_ are shown together as one group. A group may contain one Registration or many (for example under `@Many()`). Groups must not be split into unrelated free-floating nodes. The same Identifier may appear in multiple Injector clusters when parent and child each have their own registration (including overrides).

## Registration (注册)

One configured binding of an Identifier inside an Injector — how that Identifier is provided there (class, value, factory, existing, async, and related options such as lazy). Registrations are the factual units inside an Identifier Group. Instance / creation status belongs on the Registration as attributes, not as separate graph nodes. For `useAsync`, a loaded module is treated like a normal provider for edge expansion; an unloaded module appears as a Registration marked pending, without dependency edges yet.

## Dependency Edge (依赖边)

A dependency from a Registration to the Identifier Group that runtime resolution would actually use (constructor injection, factory `deps`, or an alias such as `useExisting`), honoring lookup and quantity rules such as `@Self()`, `@SkipSelf()`, `@Optional()`, and `@Many()`. The target group may live in the same Injector cluster or another cluster in the hierarchy when that is where resolution would land. If resolution would yield nothing (for example a missing `@Optional()` dependency), the graph must show that outcome explicitly rather than implying a normal link. Parent/child relationships between Injectors are shown as hierarchy structure among clusters, not as Dependency Edges. Edge targets on the Dependency Graph must not diverge from runtime behavior, and computing them must not instantiate dependencies or otherwise change application state (no inspecting via real `get()`).

## Injector Cluster (Injector 分区)

The visual boundary of one Injector on the Dependency Graph. Clusters nest or link according to parent/child Injector relationships so the whole hierarchy is visible on a single graph. When Injector Discovery finds multiple unrelated roots, the graph is a forest on one canvas, with filtering so the developer can focus on one tree.

## Resolution Trace (解析追踪)

A chronological view of dependency resolution and instance lifecycle events (when something was resolved, created, cached, or failed). Planned for a later version; not part of the first visualization release.

## DI Debugger (依赖注入调试器)

A developer-facing visual tool for inspecting a running application's dependency injection system. Its purpose is to help developers quickly understand the shape and behavior of that system — not to serve as a programmable introspection API alone.

## Debugger Overlay (调试器浮层)

The DI Debugger UI when auto-mounted into the page by calling an explicit setup function. Importing the Debugger Package must not start the debugger by itself — there are no enablement side effects on import.

## Debugger Panel (调试器面板)

The DI Debugger UI as a React component the application mounts at a location it chooses. Overlay and Panel are the same visual surface; Overlay is auto-mounted by the setup function, Panel is mounted by the application.

## Injector Discovery (Injector 发现)

How the DI Debugger learns which Injectors exist in a running application. Discovery is hybrid: the core library always keeps a lightweight registry of created Injectors (whether or not the Debugger Package is installed), React bindings may enrich that picture with where an Injector sits in the UI tree, and the developer may still explicitly register or ignore Injectors.

## Debugger Package (调试器包)

The DI Debugger ships as its own npm package, `@wendellhu/redi-devtools`, separate from `@wendellhu/redi`. The core library always maintains a lightweight Injector registry for discovery; the Overlay, Panel, and Dependency Graph UI live in the Debugger Package.

## Resolution Explain (解析说明)

A side-effect-free answer to “where would this dependency resolve?” — which Injector and Registration(s) runtime lookup would select — without instantiating anything. The Dependency Graph is built as a read-only projection: enumerate registrations, read declared dependencies, then use Resolution Explain for edge targets. Runtime `get()` stays recursive for the first version; replacing resolution itself with a graph-based engine is out of scope for the DI Debugger v1.

Resolution Explain is exposed from core under an `injector.debug` namespace (for example `injector.debug.explain(...)`), along with related introspection helpers for building the Dependency Graph. The namespace marks these as supported tooling APIs, not normal application-facing Injector operations.

## Debugger Shell (调试器壳)

How the DI Debugger is presented to a developer. The first version's shell is React: a Panel component and a setup function that auto-mounts an Overlay. Other shells (for example a remote HTTP inspector for Node.js applications) are future work and out of scope for the first version. The first version may read live in-process Injectors directly; a serializable snapshot protocol is not a requirement until a remote shell is designed.
