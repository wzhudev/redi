import type { IDisposable } from './dispose';

export interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining: () => DOMHighResTimeStamp;
}

export type DisposableCallback = () => void;

export type RunWhenIdle = (
  callback: (idle?: IdleDeadline) => void,
  timeout?: number,
) => DisposableCallback;

interface IdleGlobals {
  requestIdleCallback?: (
    callback: (args: IdleDeadline) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export function createRunWhenIdle(globals: IdleGlobals): RunWhenIdle {
  const { requestIdleCallback, cancelIdleCallback } = globals;
  if (requestIdleCallback && cancelIdleCallback) {
    return (runner, timeout?) => {
      const handle = requestIdleCallback(
        runner,
        typeof timeout === 'number' ? { timeout } : undefined,
      );

      let disposed = false;
      return () => {
        if (disposed) return;

        disposed = true;
        cancelIdleCallback(handle);
      };
    };
  }

  const dummyIdle: IdleDeadline = Object.freeze({
    didTimeout: true,
    timeRemaining() {
      return 15;
    },
  });

  return (runner) => {
    const handle = setTimeout(() => runner(dummyIdle));
    let disposed = false;
    return () => {
      if (disposed) {
        return;
      }

      disposed = true;
      clearTimeout(handle);
    };
  };
}

/**
 * this run the callback when CPU is idle. Will fallback to setTimeout if
 * the browser doesn't support requestIdleCallback
 */
export const runWhenIdle: RunWhenIdle = createRunWhenIdle(
  globalThis as IdleGlobals,
);

/**
 * a wrapper of a executor so it can be evaluated when it's necessary or the CPU is idle
 *
 * the type of the returned value of the executor would be T
 */
export class IdleValue<T> implements IDisposable {
  private readonly executor: () => void;
  private readonly disposeIdleCallback: () => void;

  private didRun = false;
  private value?: T;
  private error?: Error;

  constructor(executor: () => T) {
    this.executor = () => {
      try {
        this.value = executor();
      } catch (err: any) {
        this.error = err;
      } finally {
        this.didRun = true;
      }
    };

    this.disposeIdleCallback = runWhenIdle(() => this.executor());
  }

  hasRun(): boolean {
    return this.didRun;
  }

  dispose(): void {
    this.disposeIdleCallback();
  }

  getValue(): T {
    if (!this.didRun) {
      this.disposeIdleCallback();
      this.executor();
    }

    if (this.error) throw this.error;

    return this.value!;
  }
}
