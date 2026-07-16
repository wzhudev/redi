# ADR 0002: Always-on Injector registry in core

## Status

Accepted

## Context

Injector Discovery for the DI Debugger needs to see Injectors created in the application, including those constructed before any debugger UI is mounted. Two approaches were considered:

1. Always record created Injectors in a lightweight registry inside `@wendellhu/redi`
2. Keep a replaceable no-op hook in core and only activate bookkeeping when the Debugger Package is set up

Option 2 avoids any debugger-related work for apps that never install the debugger, but misses Injectors created before setup unless developers register them manually or start the debugger first. Option 1 makes discovery complete by default; the cost was judged negligible relative to normal Injector use.

## Decision

The core library always maintains a lightweight registry of created Injectors for Injector Discovery, even when the Debugger Package is not installed.

## Consequences

- Injectors created before the Overlay/Panel is mounted remain discoverable.
- Core carries a small, permanent discovery-related responsibility and must keep that registry correct across create/dispose (and avoid retaining disposed Injectors).
- Applications that never use the debugger still pay a small bookkeeping cost on Injector lifetime.
- The Debugger Package reads this registry rather than requiring its own monkey-patch of Injector construction to be installed first.
