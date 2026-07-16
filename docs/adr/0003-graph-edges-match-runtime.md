# ADR 0003: Dependency Graph edges match runtime resolution

## Status

Accepted

## Context

When drawing Dependency Edges on the Dependency Graph, we considered two approaches:

1. Draw edges from declared dependencies only (token + decorations as labels), without choosing targets via the same rules as runtime resolution
2. Choose edge targets using the same resolution rules the Injector uses at runtime, including `@Self()`, `@SkipSelf()`, `@Optional()`, `@Many()`, and parent-chain behavior

Option 1 is simpler to build but can show a link that runtime would not follow (or hide that an optional dependency resolves to nothing). That mismatch would mislead developers using the DI Debugger to understand the system — the opposite of the tool's purpose.

## Decision

Dependency Edges on the Dependency Graph must match runtime resolution. Lookup and quantity decorators affect where an edge lands (and whether it lands at all). The graph must not present a simpler “declared-only” picture that disagrees with what `Injector` would actually do.

## Consequences

- Building the graph requires resolution-aware logic (or equivalent introspection), not merely reading constructor metadata as a static adjacency list.
- Optional/missing and self/skip-self cases need explicit visual outcomes so “no link” is not confused with “forgot to draw the edge.”
- Graph construction is more coupled to core resolution semantics and must stay in sync when those semantics change.
- Resolution Trace (later) can build on the same “what would runtime do?” mindset rather than fighting a misleading structural model.
