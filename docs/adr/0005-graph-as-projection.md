# ADR 0005: Keep recursive resolution; graph is a projection

## Status

Accepted

## Context

Building a Dependency Graph that matches runtime lookup (without calling `get()`) raised the question of whether Injector resolution should be rewritten from today's recursive `get` / `createDependency` path into a graph-based engine the debugger could simply read.

Alternatives considered:

1. Rewrite resolution to be graph-based before shipping the DI Debugger
2. Ship the debugger only after that rewrite
3. Leave recursive resolution in place for now; build the graph as a periodic read-only projection using Resolution Explain (lookup without instantiate), and treat a graph-based resolver as a separate future change

Rewriting resolution is a large behavioral surface area for a mature library. The debugger's requirements (accurate edges, no observation side effects) can be met by sharing or mirroring the existing “find registration” logic without changing how instances are created.

## Decision

Do not change the runtime resolution model for DI Debugger v1. Keep recursive resolution. Build the Dependency Graph as a read-only projection via registration enumeration plus Resolution Explain. A graph-based resolver, if pursued, is an independent project.

## Consequences

- Faster path to a usable debugger without blocking on a core rewrite.
- Resolution Explain and `createDependency` must stay semantically aligned (preferably by sharing the find-registration path); tests should lock that parity.
- Dual models (recursive runtime + projected graph) exist until/unless resolution is later unified on a graph.
- Resolution Trace work later may revive the graph-based resolver discussion with more evidence.
