import type { Task } from 'tinybench';

/**
 * A single benchmark case. Hooks are intentionally per-iteration for
 * `beforeEach`/`afterEach` and per-phase (warmup + run) for
 * `beforeAll`/`afterAll`, matching tinybench semantics.
 */
export interface BenchCase {
  /** Logical grouping used for the report table. */
  group: string;
  /** Human readable case name. */
  name: string;
  /** The measured work. */
  fn: () => unknown;
  /**
   * Number of times `fn` is invoked per sample. The harness divides the
   * measured per-sample latency by `batch` to report per-operation numbers,
   * which stabilizes sub-microsecond measurements. Only valid for synchronous
   * `fn`.
   */
  batch?: number;
  /** Mark the case as asynchronous so tinybench times the returned promise. */
  async?: boolean;
  /** Runs once before the iterations of a task phase. */
  beforeAll?: () => void | Promise<void>;
  /** Runs after all iterations of a task phase. */
  afterAll?: () => void | Promise<void>;
  /** Runs before each iteration. */
  beforeEach?: () => void | Promise<void>;
  /** Runs after each iteration. */
  afterEach?: () => void | Promise<void>;
}

/** A normalized benchmark result, grouped and ready for reporting. */
export interface BenchResult {
  group: string;
  name: string;
  fullName: string;
  opsPerSec: number;
  latencyMeanMs: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  rmePercent: number;
  samples: number;
}

export const TASK_NAME_SEPARATOR = ' :: ';

export function makeTaskName(group: string, name: string): string {
  return `${group}${TASK_NAME_SEPARATOR}${name}`;
}

export function splitTaskName(taskName: string): [string, string] {
  const index = taskName.indexOf(TASK_NAME_SEPARATOR);
  if (index === -1) {
    return ['general', taskName];
  }
  return [
    taskName.slice(0, index),
    taskName.slice(index + TASK_NAME_SEPARATOR.length),
  ];
}

/**
 * Extract a reportable result from a tinybench task. Returns `null` when the
 * task did not complete (errored/aborted).
 *
 * `batch` is the number of operations executed per sample; per-op statistics
 * are derived by scaling the measured per-sample statistics.
 */
export function taskToResult(task: Task, batch = 1): BenchResult | null {
  const result = task.result;
  if (result.state !== 'completed') {
    return null;
  }

  const [group, name] = splitTaskName(task.name);

  return {
    group,
    name,
    fullName: task.name,
    // Median throughput is far more robust to GC/scheduler outliers than the
    // mean, which matters when these numbers drive regression alerts.
    opsPerSec: result.throughput.p50 * batch,
    latencyMeanMs: result.latency.mean / batch,
    latencyP50Ms: result.latency.p50 / batch,
    latencyP99Ms: result.latency.p99 / batch,
    rmePercent: result.latency.rme,
    samples: result.latency.samplesCount,
  };
}

/** The shape written to JSON and consumed by CI tooling / the baseline. */
export interface SerializedResult {
  name: string;
  unit: 'ops/sec';
  value: number;
  group: string;
  latencyMeanMs: number;
  p99Ms: number;
  rmePercent: number;
  samples: number;
}

export function serializeResult(result: BenchResult): SerializedResult {
  return {
    name: result.fullName,
    unit: 'ops/sec',
    value: round(result.opsPerSec, 3),
    group: result.group,
    latencyMeanMs: round(result.latencyMeanMs, 6),
    p99Ms: round(result.latencyP99Ms, 6),
    rmePercent: round(result.rmePercent, 3),
    samples: result.samples,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function msToNs(value: number): number {
  return value * 1e6;
}

export function renderMarkdown(results: BenchResult[]): string {
  const lines: string[] = [];
  const groups = [...new Set(results.map((result) => result.group))].sort();

  for (const group of groups) {
    const groupResults = results.filter((result) => result.group === group);
    lines.push(`### ${group}`, '');
    lines.push(
      '| Benchmark | ops/sec | mean (ns) | p50 (ns) | p99 (ns) | RME | samples |',
      '| :-- | --: | --: | --: | --: | --: | --: |',
    );

    for (const result of groupResults) {
      lines.push(
        `| ${result.name} | ${formatNumber(result.opsPerSec, 0)} | ${formatNumber(
          msToNs(result.latencyMeanMs),
          1,
        )} | ${formatNumber(msToNs(result.latencyP50Ms), 1)} | ${formatNumber(
          msToNs(result.latencyP99Ms),
          1,
        )} | ±${formatNumber(result.rmePercent, 1)}% | ${result.samples} |`,
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function renderTerminal(results: BenchResult[]): string {
  const nameWidth = Math.min(
    64,
    Math.max(12, ...results.map((result) => result.name.length)),
  );
  const lines: string[] = [];

  for (const result of results) {
    const name = result.name.padEnd(nameWidth);
    lines.push(
      `${name}  ${formatNumber(result.opsPerSec, 0).padStart(12)} ops/sec  ` +
      `${formatNumber(msToNs(result.latencyMeanMs), 1).padStart(10)} ns  ` +
      `±${formatNumber(result.rmePercent, 1)}%`,
    );
  }

  return lines.join('\n');
}
