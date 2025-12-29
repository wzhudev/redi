import type { Observable, Subscription } from 'rxjs';
import { RediError } from '@wendellhu/redi';
import { useEffect, useMemo, useRef, useState } from 'react';

type ObservableOrFn<T> = Observable<T> | (() => Observable<T>);
type Nullable<T> = T | undefined | null;

function unwrap<T>(o: ObservableOrFn<T>): Observable<T> {
  if (typeof o === 'function') {
    return o();
  }

  return o;
}

export function useObservable<T>(observable: Nullable<ObservableOrFn<T>>): T;
export function useObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue: T,
): T;
export function useObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue: undefined,
  shouldHaveSyncValue: true,
  deps?: any[],
): T;
export function useObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue?: undefined,
  shouldHaveSyncValue?: true,
  deps?: any[],
): T | undefined;
/**
 * Subscribe to an observable and return its value. The component will re-render when the observable emits a new value.
 *
 * @param observable An observable or a function that returns an observable
 * @param defaultValue The default value of the observable. It the `observable` can omit an initial value, this value will be neglected.
 * @param shouldHaveSyncValue If the observable should have a sync value. If it does not have a sync value, an error will be thrown.
 * @param deps A dependency array to decide if we should re-subscribe when the `observable` is a function.
 * @returns Value or null.
 */
export function useObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue?: undefined,
  shouldHaveSyncValue?: true,
  deps?: any[],
): T | undefined {
  if (typeof observable === 'function' && !deps) {
    throw new RediError(
      'Expected deps to be provided when observable is a function!',
    );
  }

  const destObservable = useMemo(
    () => observable,
    [...(typeof deps !== 'undefined' ? deps : [observable])],
  );

  const observableRef = useRef<Nullable<ObservableOrFn<T>>>(undefined);
  const subscriptionRef = useRef<Subscription | null>(null);
  const syncReceivedValueRef = useRef<boolean>(false);

  // This state is only for trigger React to re-render. We do not use `setValue`
  // directly because it may cause memory leaking in React.
  const [_, setRenderCounter] = useState<number>(0);
  const valueRef = useRef<T | undefined>(defaultValue ?? undefined);

  if (observableRef.current !== destObservable) {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    observableRef.current = destObservable;

    if (destObservable) {
      subscriptionRef.current = unwrap(destObservable).subscribe((value) => {
        valueRef.current = value;
        if (syncReceivedValueRef.current === false) {
          syncReceivedValueRef.current = true;
        } else {
          setRenderCounter((prev) => (prev + 1) % Number.MAX_SAFE_INTEGER);
        }
      });
    }
  }

  if (shouldHaveSyncValue && !syncReceivedValueRef.current) {
    throw new Error(
      '[redi]: Expect `shouldHaveSyncValue` but not getting a sync value!',
    );
  }

  syncReceivedValueRef.current = true;

  return valueRef.current;
}

/**
 * A React hook that re-renders the component when an Observable emits.
 *
 * This is useful when you have external state managed by RxJS and want
 * to trigger a re-render whenever that state changes, without using
 * the emitted value directly.
 *
 * @param update$ - An Observable that emits when the component should re-render.
 *
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const statusService = useDependency(StatusService);
 *
 *   // Re-render whenever status changes
 *   useUpdateBinder(statusService.statusChanged$);
 *
 *   return <div>{statusService.getCurrentStatus()}</div>;
 * }
 * ```
 */
export function useUpdateBinder(update$: Observable<void>): void {
  const [, dumpSet] = useState(0);

  useEffect(() => {
    const subscription = update$.subscribe(() => dumpSet((prev) => prev + 1));
    return () => subscription.unsubscribe();
  }, []);
}
