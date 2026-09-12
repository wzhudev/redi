# DI Debugger v1 — ticket index

Spec: [docs/specs/di-debugger-v1.md](../../docs/specs/di-debugger-v1.md)

Work the **frontier**: any ticket whose blockers are done. 01 and 02 can start in parallel.

| #                                                       | Title                                      | Blocked by           |
| ------------------------------------------------------- | ------------------------------------------ | -------------------- |
| [01](./issues/01-scaffold-redi-devtools.md)             | Scaffold `@wendellhu/redi-devtools`        | —                    |
| [02](./issues/02-injector-discovery-registry.md)        | Injector Discovery registry                | —                    |
| [03](./issues/03-debug-registration-listing.md)         | `injector.debug` registration listing      | 02                   |
| [04](./issues/04-resolution-explain.md)                 | Resolution Explain                         | 03                   |
| [05](./issues/05-graph-panel.md)                        | Dependency Graph + Debugger Panel          | 01, 03, 04           |
| [06](./issues/06-overlay-setup.md)                      | Debugger Overlay setup                     | 05                   |
| [07](./issues/07-filter-selection-polling.md)           | Forest filter, selection, polling          | 05                   |
| [08](./issues/08-async-and-react-enrichment.md)         | Async + React enrichment                   | 05 (enrichment ↔ 02) |
| [09](./issues/09-discovery-registry-memory-and-perf.md) | Discovery registry: weak refs + roots only | 02                   |

```mermaid
flowchart LR
  T01[01 Scaffold]
  T02[02 Discovery]
  T03[03 Listing]
  T04[04 Explain]
  T05[05 Graph Panel]
  T06[06 Overlay]
  T07[07 UX polish]
  T08[08 Async React]
  T09[09 Discovery weak/roots]
  T02 --> T03 --> T04
  T02 --> T09
  T01 --> T05
  T03 --> T05
  T04 --> T05
  T05 --> T06
  T05 --> T07
  T05 --> T08
```
