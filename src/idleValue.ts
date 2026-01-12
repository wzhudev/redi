import type { IDisposable } from './dispose';

export interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining: () => DOMHighResTimeStamp;
}

export type DisposableCallback = () => void;

/**
 * this run the callback when CPU is idle. Will fallback to setTimeout if
 * the browser doesn't support requestIdleCallback
 */
// eslint-disable-next-line import/no-mutable-exports
export let runWhenIdle: (callback: (idle?: IdleDeadline) => void, timeout?: number) => DisposableCallback;

// declare global variables because apparently the type file doesn't have it, for now
declare function requestIdleCallback(callback: (args: IdleDeadline) => void, options?: { timeout: number }): number;
declare function cancelIdleCallback(handle: number): void;

// use an IIFE to set up runWhenIdle
(function () {
  // this API is not available in Node.js, so we need to ignore it in tests
  /* istanbul ignore next -- @preserve */
  if (typeof requestIdleCallback !== 'undefined' && typeof cancelIdleCallback !== 'undefined') {
    // use native requestIdleCallback
    runWhenIdle = (runner, timeout?) => {
      const handle: number = requestIdleCallback(runner, typeof timeout === 'number' ? { timeout } : undefined);

      let disposed = false;
      return () => {
        if (disposed) return;

        disposed = true;
        cancelIdleCallback(handle);
      };
    };
  } else {
    // use setTimeout as hack
    const dummyIdle: IdleDeadline = Object.freeze({
      didTimeout: true,
      /* istanbul ignore next */
      timeRemaining() {
        return 15;
      },
    });

    runWhenIdle = (runner) => {
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
})();

/**
 * a wrapper of a executor so it can be evaluated when it's necessary or the CPU is idle
 *
 * the type of the returned value of the executor would be T
 */
export class IdleValue<T> implements IDisposable {
  private readonly _executor: () => void;
  private readonly _disposeIdleCallback: () => void;

  private _didRun = false;
  private _value?: T;
  private _error?: Error;

  constructor(executor: () => T) {
    this._executor = () => {
      try {
        this._value = executor();
      } catch (err: any) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    };

    this._disposeIdleCallback = runWhenIdle(() => this._executor());
  }

  hasRun(): boolean {
    return this._didRun;
  }

  dispose(): void {
    this._disposeIdleCallback();
  }

  getValue(): T {
    if (!this._didRun) {
      this._disposeIdleCallback();
      this._executor();
    }

    if (this._error) throw this._error;

    return this._value!;
  }
}
