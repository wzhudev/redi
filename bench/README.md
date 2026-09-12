# redi benchmarks

Performance benchmarks for redi's two core abilities:

1. **Resolution** — token lookup, hierarchical injector traversal, type
   dispatch, caching and metadata reads.
2. **Instantiation** — building object graphs (`new Ctor(...)`), factories,
   `createInstance`, `WithNew` and `lazy`.

The suite is powered by [`tinybench`](https://github.com/tinylibs/tinybench)
and runs on Bun. Nothing here ships to consumers: `package.json > files` only
publishes `dist`.

## Running

```bash
# Full suite
bun run bench

# Only cases whose "group :: name" contains a substring
bun run bench --filter=resolve

# Machine-readable output (stdout is pure JSON; logs go to stderr)
bun run bench --json
bun run bench --json --output=bench/results.json

# Markdown table (handy for PR descriptions)
bun run bench --markdown

# Compare against the committed baseline
bun run bench:compare

# Regenerate the baseline after an intentional performance change
bun run bench:update-baseline
```

Useful flags: `--time=<ms>` (measured budget per case, default 300),
`--warmup=<ms>` (warmup budget, default 100), `--warn-threshold=<percent>`
and `--fail-threshold=<percent>`.

## Layout

```
bench/
├── index.ts              # CLI runner: filtering, reporting, baseline handling
├── harness.ts            # tinybench result normalization + rendering
├── compare.ts            # baseline comparison with warn/fail thresholds
├── redi.ts               # single import point for the library under test
├── fixtures/
│   ├── graph.ts          # deep / wide / alias / factory graph generators
│   └── cases.ts          # hot & cold case factories
├── scenarios/
│   ├── primitives.bench.ts    # new Injector(...) with N registrations
│   ├── resolve.bench.ts       # cached hits, pure traversal, misses
│   ├── instantiate.bench.ts   # cold deep/wide graph construction
│   ├── hierarchy.bench.ts     # parent lookup + SELF / SKIP_SELF
│   └── variants.bench.ts      # MANY, factory, createInstance, WithNew, lazy, async
└── baseline.json         # committed results used by bench:compare
```

## Design notes

- **Hot vs cold.** `makeHotCase` primes a dependency and re-resolves it
  (cache-hit path). `makeColdCase` builds a fresh injector before every
  iteration and resolves for the first time (traversal + instantiation). The
  hook work happens outside the timed window, so only the measured operation
  counts.
- **Construction isolation.** Alias (`useExisting`) and factory chains
  (factory returns its dependency) measure pure resolution/traversal without
  paying for real constructors, which separates resolver cost from `new`.
- **Batching.** Sub-microsecond hot paths are run `batch` times per sample
  (default 1000) and scaled back to per-operation numbers. This keeps samples
  well above the timer resolution.
- **Median throughput.** The reported `ops/sec` is the median of the sample
  throughput, which is far more robust to GC/scheduler outliers than the mean.
  The `RME` column reports the relative margin of error for the latency stats.
- **Async.** Async cases must set `async: true`; tinybench cannot always
  auto-detect a promise-returning wrapper.

## Baseline & regression detection

`bench/baseline.json` stores `{ name, unit, value, ... }` entries.
`bench:compare` matches by the full `group :: name` key and reports the delta:

```
  ↑ resolve :: hot class chain (depth=20)   50,352,467 ops/sec   +20.0%
  = resolve :: has() missing                35,714,285 ops/sec    +0.0%
  ✗ instantiate :: cold deep chain           ...                  -35.0%
```

- `warn` when slower than the baseline by more than `--warn-threshold` (15%).
- `fail` (exit code 1) when slower than `--fail-threshold` (30%). Pass
  `--no-fail` to always exit 0.

**The baseline is machine-specific.** Absolute throughput depends on CPU,
thermal state and other load. Generate the baseline on the same machine/runner
you compare against, or compare only _trends_ across commits. CI noise is
usually much lower than a developer laptop, so tune thresholds per environment.

## CI

The CI workflow runs the suite as a smoke test and uploads
`bench/results.json` as an artifact. It does not gate on the committed baseline
by default, because the baseline is generated locally. To add gating, run
`bun run bench:compare` (optionally `--no-fail`) and upload the JSON to your
preferred trend tracker.
