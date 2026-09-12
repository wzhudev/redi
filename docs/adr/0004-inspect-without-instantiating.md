# ADR 0004: Inspect without instantiating

## Status

Accepted

## Context

The Dependency Graph must show edge targets that match runtime resolution, including lookup decorators. That requirement can be satisfied in two ways:

1. Call the real `get()` / creation path while building or refreshing the graph
2. Perform a side-effect-free lookup that answers “where would this resolve?” without creating instances or running factories

Using real `get()` would make observation change the system under study (for example by instantiating lazy dependencies during polling). That surprises developers and undermines trust in the DI Debugger.

## Decision

Graph construction and refresh must never inspect by calling real `get()` or otherwise instantiating dependencies. Edge targeting and creation-status display use side-effect-free introspection only.

## Consequences

- Core (or a carefully shared helper) needs a resolution-explaining path that mirrors runtime rules without creating instances.
- Lazy / not-yet-created registrations stay uncreated while the debugger runs; their status is shown as attributes, not forced into existence.
- Keeping “explain resolution” and “perform resolution” in sync becomes an ongoing correctness obligation.
- This decision does not by itself require replacing recursive runtime resolution with a graph-based resolver; that is a separate architectural question.
