import type { SerializedResult } from './harness';

export type ComparisonStatus =
  | 'unchanged'
  | 'improved'
  | 'warn'
  | 'fail'
  | 'new';

export interface Comparison {
  name: string;
  currentValue: number;
  baselineValue: number | null;
  deltaPercent: number | null;
  status: ComparisonStatus;
}

export interface CompareOptions {
  warnThreshold: number;
  failThreshold: number;
}

/**
 * Compare current results against a committed baseline. Thresholds are
 * percentages: a result slower than the baseline by more than `failThreshold`
 * is marked as a failure, by more than `warnThreshold` as a warning.
 */
export function compareResults(
  current: SerializedResult[],
  baseline: SerializedResult[],
  { warnThreshold, failThreshold }: CompareOptions,
): Comparison[] {
  const baselineByName = new Map(
    baseline.map((entry) => [entry.name, entry.value]),
  );

  return current.map((entry) => {
    const baselineValue = baselineByName.get(entry.name);

    if (baselineValue === undefined) {
      return {
        name: entry.name,
        currentValue: entry.value,
        baselineValue: null,
        deltaPercent: null,
        status: 'new' as const,
      };
    }

    const deltaPercent =
      baselineValue === 0
        ? 0
        : ((entry.value - baselineValue) / baselineValue) * 100;

    let status: ComparisonStatus = 'unchanged';
    if (deltaPercent <= -failThreshold) {
      status = 'fail';
    } else if (deltaPercent <= -warnThreshold) {
      status = 'warn';
    } else if (deltaPercent >= warnThreshold) {
      status = 'improved';
    }

    return {
      name: entry.name,
      currentValue: entry.value,
      baselineValue,
      deltaPercent,
      status,
    };
  });
}

const STATUS_LABEL: Record<ComparisonStatus, string> = {
  unchanged: '  =',
  improved: '  ↑',
  warn: '  !',
  fail: '  ✗',
  new: '  +',
};

function formatOpsPerSec(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDelta(deltaPercent: number | null): string {
  if (deltaPercent === null) {
    return 'n/a';
  }
  const sign = deltaPercent >= 0 ? '+' : '';
  return `${sign}${deltaPercent.toFixed(1)}%`;
}

export function renderComparison(comparisons: Comparison[]): string {
  const nameWidth = Math.max(
    12,
    ...comparisons.map((comparison) => comparison.name.length),
  );

  return comparisons
    .map((comparison) => {
      const name = comparison.name.padEnd(nameWidth);
      const current = formatOpsPerSec(comparison.currentValue).padStart(12);
      const delta = formatDelta(comparison.deltaPercent).padStart(9);
      return `${STATUS_LABEL[comparison.status]} ${name}  ${current} ops/sec  ${delta}`;
    })
    .join('\n');
}

export function hasFailures(comparisons: Comparison[]): boolean {
  return comparisons.some((comparison) => comparison.status === 'fail');
}
