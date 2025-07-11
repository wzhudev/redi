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

  const observableRef = useRef<Observable<T> | null>(null);
  const initializedRef = useRef<boolean>(false);

  const destObservable = useMemo(
    () => observable,
    [...(typeof deps !== 'undefined' ? deps : [observable])],
  );

  // This state is only for trigger React to re-render. We do not use `setValue` directly because it may cause
  // memory leaking.
  const [_, setRenderCounter] = useState<number>(0);

  const valueRef = useRef<T | undefined>(
    (() => {
      let innerDefaultValue: T | undefined;
      if (destObservable) {
        const sub = unwrap(destObservable).subscribe((value) => {
          initializedRef.current = true;
          innerDefaultValue = value;
        });

        sub.unsubscribe();
      }

      return innerDefaultValue ?? defaultValue;
    })(),
  );

  useEffect(() => {
    let subscription: Subscription | null = null;
    if (destObservable) {
      observableRef.current = unwrap(destObservable);
      subscription = observableRef.current.subscribe((value) => {
        valueRef.current = value;
        setRenderCounter((prev) => prev + 1);
      });
    }

    return () => subscription?.unsubscribe();
  }, [destObservable]);

  if (shouldHaveSyncValue && !initializedRef.current) {
    throw new Error(
      '[redi]: Expect `shouldHaveSyncValue` but not getting a sync value!',
    );
  }

  return valueRef.current;
}

/**
 * subscribe to a signal that emits whenever data updates and re-render
 *
 * @param update$ a signal that the data the functional component depends has updated
 */
export function useUpdateBinder(update$: Observable<void>): void {
  const [, dumpSet] = useState(0);

  useEffect(() => {
    const subscription = update$.subscribe(() => dumpSet((prev) => prev + 1));
    return () => subscription.unsubscribe();
  }, []);
}
