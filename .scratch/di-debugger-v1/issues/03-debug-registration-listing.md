# 03 — `injector.debug` registration listing and creation status

**What to build:** Under the non-business `injector.debug` namespace, tooling can list every Registration in an Injector grouped by Identifier, including provider kind (class/value/factory/existing/async), options such as lazy, and whether an instance already exists — all without calling `get()` or creating instances.

**Blocked by:** 02 — Injector Discovery registry (needs the `debug` tooling foothold and live Injectors to inspect).

**Status:** done

- [x] `injector.debug` exposes registration listing suitable for Identifier Groups
- [x] Listing reports provider kind and relevant options (e.g. lazy) per Registration
- [x] Creation status is readable (created vs not created) without instantiating lazy providers
- [x] Listing a lazy, never-`get`’d Registration leaves it uncreated
- [x] Tests cover bare class, useClass/value/factory/existing, Many-style multi-registration, and lazy status
