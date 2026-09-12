/* eslint-disable no-console */
import type { BenchCase, BenchResult, SerializedResult } from './harness';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { Bench } from 'tinybench';
import { compareResults, hasFailures, renderComparison } from './compare';
import {
  makeTaskName,
  renderMarkdown,
  renderTerminal,
  serializeResult,
  taskToResult,
} from './harness';
import { allCases } from './scenarios';

interface Options {
  compare?: string;
  failThreshold: number;
  filter?: string;
  json: boolean;
  markdown: boolean;
  noFail: boolean;
  output?: string;
  time: number;
  updateBaseline: boolean;
  warmupTime: number;
  warnThreshold: number;
}

const BASELINE_PATH = resolve(import.meta.dir, 'baseline.json');

function parseNumericArg(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseOptions(argv: string[]): Options | null {
  const options: Options = {
    failThreshold: 30,
    json: false,
    markdown: false,
    noFail: false,
    time: 300,
    updateBaseline: false,
    warmupTime: 100,
    warnThreshold: 15,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      return null;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--markdown') {
      options.markdown = true;
    } else if (arg === '--update-baseline') {
      options.updateBaseline = true;
    } else if (arg === '--no-fail') {
      options.noFail = true;
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.slice('--filter='.length);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else if (arg.startsWith('--compare=')) {
      options.compare = arg.slice('--compare='.length);
    } else if (arg.startsWith('--time=')) {
      options.time = parseNumericArg(arg.slice('--time='.length), options.time);
    } else if (arg.startsWith('--warmup=')) {
      options.warmupTime = parseNumericArg(
        arg.slice('--warmup='.length),
        options.warmupTime,
      );
    } else if (arg.startsWith('--warn-threshold=')) {
      options.warnThreshold = parseNumericArg(
        arg.slice('--warn-threshold='.length),
        options.warnThreshold,
      );
    } else if (arg.startsWith('--fail-threshold=')) {
      options.failThreshold = parseNumericArg(
        arg.slice('--fail-threshold='.length),
        options.failThreshold,
      );
    } else {
      console.warn(`[bench] Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`redi benchmark runner

Usage:
  bun run bench [options]

Options:
  --filter=<substring>       Only run cases whose "group :: name" contains the substring
  --time=<ms>                Time budget per task (default: 300)
  --warmup=<ms>              Warmup time budget per task (default: 100)
  --json                     Print results as JSON
  --markdown                 Print results as a markdown table
  --output=<path>            Write JSON results to a file
  --update-baseline          Write results to bench/baseline.json
  --compare=<path>           Compare results against a baseline JSON file
  --warn-threshold=<percent> Warn when slower than baseline by this much (default: 15)
  --fail-threshold=<percent> Fail when slower than baseline by this much (default: 30)
  --no-fail                  Always exit with code 0 when comparing
  -h, --help                 Print this help
`);
}

function readJsonArray(path: string): SerializedResult[] {
  return JSON.parse(readFileSync(path, 'utf8')) as SerializedResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeMeasuredFn(benchCase: BenchCase): () => unknown {
  const { batch, fn } = benchCase;
  if (!batch || batch <= 1) {
    return fn;
  }

  return () => {
    for (let index = 0; index < batch; index += 1) {
      fn();
    }
  };
}

async function runBench(options: Options): Promise<BenchResult[]> {
  const selected = allCases.filter((benchCase) => {
    if (!options.filter) {
      return true;
    }
    const haystack = makeTaskName(
      benchCase.group,
      benchCase.name,
    ).toLowerCase();
    return haystack.includes(options.filter.toLowerCase());
  });

  if (selected.length === 0) {
    throw new Error('No benchmark cases matched the given filter.');
  }

  console.error(
    `[bench] Running ${selected.length} case(s) (time=${options.time}ms, warmup=${options.warmupTime}ms)...\n`,
  );

  const bench = new Bench({
    time: options.time,
    warmupTime: options.warmupTime,
    warmup: true,
    throws: false,
  });

  for (const benchCase of selected) {
    bench.add(
      makeTaskName(benchCase.group, benchCase.name),
      makeMeasuredFn(benchCase),
      {
        async: benchCase.async,
        beforeAll: benchCase.beforeAll,
        afterAll: benchCase.afterAll,
        beforeEach: benchCase.beforeEach,
        afterEach: benchCase.afterEach,
      },
    );
  }

  const batchByTaskName = new Map(
    selected.map((benchCase) => [
      makeTaskName(benchCase.group, benchCase.name),
      benchCase.batch ?? 1,
    ]),
  );

  await bench.run();

  const results: BenchResult[] = [];
  for (const task of bench.tasks) {
    const result = taskToResult(task, batchByTaskName.get(task.name) ?? 1);
    if (!result) {
      const state = task.result.state;
      const detail = state === 'errored' ? `: ${task.result.error.stack}` : '';
      console.error(
        `[bench] Task did not complete: ${task.name} (state: ${state})${detail}`,
      );
      continue;
    }
    results.push(result);
  }

  return results;
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    printHelp();
    return 0;
  }

  const results = await runBench(options);
  const serialized = results.map(serializeResult);

  if (options.json) {
    console.log(JSON.stringify(serialized, null, 2));
  } else if (options.markdown) {
    console.log(renderMarkdown(results));
  } else {
    console.log(renderTerminal(results));
    console.log('');
    console.log(renderMarkdown(results));
  }

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    writeJson(outputPath, serialized);
    console.error(`\n[bench] Wrote results to ${outputPath}`);
  }

  if (options.updateBaseline) {
    writeJson(BASELINE_PATH, serialized);
    console.error(`\n[bench] Updated baseline at ${BASELINE_PATH}`);
  }

  if (options.compare) {
    const baselinePath = resolve(process.cwd(), options.compare);
    const baseline = readJsonArray(baselinePath);
    const comparisons = compareResults(serialized, baseline, {
      warnThreshold: options.warnThreshold,
      failThreshold: options.failThreshold,
    });

    console.error(`\n[bench] Comparison against ${baselinePath}:\n`);
    console.error(renderComparison(comparisons));

    if (hasFailures(comparisons) && !options.noFail) {
      console.error('\n[bench] Regression threshold exceeded.');
      return 1;
    }
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
