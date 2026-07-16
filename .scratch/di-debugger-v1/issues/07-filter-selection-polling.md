# 07 — Forest filter, selection details, polling controls

**What to build:** On the shared Debugger UI, developers can filter a multi-root forest down to one tree, select a Registration or Identifier Group to see details (kind, status, edge/lookup info), and control polling (interval override and/or manual refresh) so large apps stay usable.

**Blocked by:** 05 — Dependency Graph projection + Debugger Panel.

**Status:** ready-for-agent

- [ ] Multi-root forest renders; filter can focus one tree
- [ ] Selecting a group/registration shows a details view with kind, status, and relevant edge/lookup information
- [ ] Polling interval is configurable and/or manual refresh is available
- [ ] Basic navigation of a large graph remains possible (pan/zoom or equivalent scroll)
- [ ] Works for both Panel and Overlay (shared surface)
