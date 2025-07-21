import type { Observable } from 'rxjs';
import { RediError } from '@wendellhu/redi';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

type ObservableOrFn<T> = Observable<T> | (() => Observable<T>);
type Nullable<T> = T | undefined | null;

function unwrap<T>(o: ObservableOrFn<T>): Observable<T> {
  if (typeof o === 'function') {
    return o();
  }

  return o;
}

export function useNeoObservable<T>(observable: Nullable<ObservableOrFn<T>>): T;
export function useNeoObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue: T,
): T;
export function useNeoObservable<T>(
  observable: Nullable<ObservableOrFn<T>>,
  defaultValue: undefined,
  shouldHaveSyncValue: true,
  deps?: any[],
): T;
export function useNeoObservable<T>(
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
export function useNeoObservable<T>(
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

  // Create a stable reference to track the current observable and its state
  const stateRef = useRef<{
    observable: Observable<T> | null;
    currentValue: T | undefined;
    initialized: boolean;
  }>({
    observable: null,
    currentValue: defaultValue,
    initialized: false,
  });

  // Update the observable reference and get initial value when destObservable changes
  if (destObservable) {
    const unwrapped = unwrap(destObservable);
    if (stateRef.current.observable !== unwrapped) {
      stateRef.current.observable = unwrapped;

      // Try to get the initial sync value
      let hasInitialValue = false;
      const subscription = unwrapped.subscribe((value) => {
        stateRef.current.currentValue = value;
        stateRef.current.initialized = true;
        hasInitialValue = true;
      });
      subscription.unsubscribe();

      if (!hasInitialValue) {
        stateRef.current.currentValue = defaultValue;
        stateRef.current.initialized = false;
      }
    }
  } else if (stateRef.current.observable !== null) {
    // Observable changed to null
    stateRef.current.observable = null;
    stateRef.current.currentValue = defaultValue;
    stateRef.current.initialized = false;
  }

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback(
    (callback: () => void) => {
      const currentObservable = destObservable ? unwrap(destObservable) : null;
      if (!currentObservable) {
        return () => {}; // No-op unsubscribe function
      }

      const subscription = currentObservable.subscribe((value) => {
        stateRef.current.currentValue = value;
        stateRef.current.initialized = true;
        callback(); // Notify React of state change
      });

      return () => subscription.unsubscribe();
    },
    [destObservable],
  );

  // Get snapshot function for useSyncExternalStore
  const getSnapshot = useCallback(() => {
    return stateRef.current.currentValue;
  }, []);

  // Server snapshot (for SSR)
  const getServerSnapshot = useCallback(() => {
    return defaultValue;
  }, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (shouldHaveSyncValue && !stateRef.current.initialized) {
    throw new Error(
      '[redi]: Expect `shouldHaveSyncValue` but not getting a sync value!',
    );
  }

  return value;
}

/**
 * subscribe to a signal that emits whenever data updates and re-render
 *
 * @param update$ a signal that the data the functional component depends has updated
 */
export function useNeoUpdateBinder(update$: Observable<void>): void {
  const counterRef = useRef(0);

  const subscribe = useCallback(
    (callback: () => void) => {
      const subscription = update$.subscribe(() => {
        counterRef.current += 1;
        callback();
      });
      return () => subscription.unsubscribe();
    },
    [update$],
  );

  const getSnapshot = useCallback(() => {
    return counterRef.current;
  }, []);

  const getServerSnapshot = useCallback(() => {
    return 0;
  }, []);

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
