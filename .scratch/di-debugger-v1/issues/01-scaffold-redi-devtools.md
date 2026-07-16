# 01 — Scaffold `@wendellhu/redi-devtools`

**What to build:** Developers can depend on a separate `@wendellhu/redi-devtools` package that builds cleanly, declares its dependency on `@wendellhu/redi` and React, and does nothing when imported. No Debugger UI is required yet — only a publishable/workspace package shell ready for later tickets to fill in.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Package `@wendellhu/redi-devtools` exists in the monorepo/workspace and can be built with the repo’s normal tooling
- [ ] Importing the package entry has no enablement side effects (no Overlay, no global listeners started by import alone)
- [ ] Package correctly depends on `@wendellhu/redi` and React in line with how `react-bindings` treats React
- [ ] Minimal public export surface exists so later tickets can add Panel/setup without reshaping the package
