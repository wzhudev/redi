# 06 — Debugger Overlay setup auto-mount

**What to build:** Developers can call an explicit setup function that auto-mounts a Debugger Overlay using the same Dependency Graph surface as the Panel, and can tear it down cleanly. Importing the package still does not start the Overlay by itself.

**Blocked by:** 05 — Dependency Graph projection + Debugger Panel.

**Status:** ready-for-agent

- [ ] Setup function mounts Overlay without requiring the app to render Panel itself
- [ ] Overlay shows the same graph surface/behavior as Panel
- [ ] Setup/teardown does not leak DOM roots or timers after dispose/unmount
- [ ] Import alone still does not mount Overlay
- [ ] Tests cover mount and unmount of setup
