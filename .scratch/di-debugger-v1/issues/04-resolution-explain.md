# 04 — Resolution Explain with runtime parity

**What to build:** Tooling can ask Resolution Explain — “where would this dependency resolve?” — via `injector.debug` and get the same Injector/Registration landings runtime lookup would use (`@Self`, `@SkipSelf`, `@Optional`, `@Many`, child overrides, `useExisting`), without instantiating anything. Explain shares find-registration rules with real resolution so the Dependency Graph will not lie.

**Blocked by:** 03 — `injector.debug` registration listing and creation status.

**Status:** done

- [x] `injector.debug.explain` (or equivalent) returns landings for identifier + quantity + lookUp without calling `get()`
- [x] SELF / SKIP_SELF / default parent walk / OPTIONAL empty / MANY / child override / `useExisting` match runtime lookup semantics
- [x] Required-missing and optional-missing are explicit outcomes (not silent omission)
- [x] Explain never instantiates lazy (or other) providers; creation status unchanged afterward
- [x] Parity tests lock Explain landings against known registration locations / post-hoc `get` assertion lane where appropriate
