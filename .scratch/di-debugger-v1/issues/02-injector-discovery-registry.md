# 02 — Injector Discovery registry

**What to build:** Every live Injector is discoverable for tooling: construction adds it to a lightweight core registry, dispose removes it, and parent/child relationships can be reconstructed into a forest. Developers can also explicitly register or ignore Injectors when automatic Discovery is wrong. Apps that never install devtools still only pay cheap bookkeeping.

**Blocked by:** None — can start immediately (parallel with 01).

**Status:** ready-for-agent

- [ ] Creating an Injector registers it; disposing unregisters it with no leak of disposed instances
- [ ] Parent/child Injectors appear as a reconstructible forest (multiple roots allowed)
- [ ] Explicit register and ignore APIs work for unusual setups
- [ ] Tooling can read the registry (module-level or `injector.debug` helper) without instantiating dependencies
- [ ] Tests cover construct/dispose, hierarchy, multi-root, and register/ignore
