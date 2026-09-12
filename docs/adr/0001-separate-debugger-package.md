# ADR 0001: Ship the DI Debugger as a separate package

## Status

Accepted

## Context

We are adding a DI Debugger so developers can visually inspect a running application's Dependency Graph. The debugger includes an in-page Overlay (and an embeddable Panel) — UI that is substantially heavier than the core DI runtime.

Two delivery options were considered:

1. Ship the debugger as a subpath of `@wendellhu/redi` (e.g. `@wendellhu/redi/debug`)
2. Ship the debugger as a separate npm package, with only a thin discovery hook in core

A subpath is convenient (no extra install) but makes it easier for UI code to leak into production bundles and couples debugger release cadence to the core library. A separate package keeps the core slim and makes "this is dev-only" explicit at the dependency boundary.

## Decision

Ship the DI Debugger as a separate npm package. `@wendellhu/redi` may include only a thin, opt-in hook needed for Injector Discovery; Overlay, Panel, and graph UI live outside the core package.

## Consequences

- Applications that want the debugger add an explicit dependency and import it deliberately.
- Core package size and API surface stay focused on DI runtime concerns.
- The discovery hook in core must stay minimal and safe when the debugger package is absent.
- Debugger and core may version on somewhat independent cadences, but the hook contract between them becomes a compatibility surface we must maintain.
