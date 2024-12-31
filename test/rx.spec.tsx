/**
 * @vitest-environment jsdom
 */

import type { IDisposable } from '@wendellhu/redi'
import type { Observable } from 'rxjs'
import { act, render, renderHook } from '@testing-library/react'
import {
  connectDependencies,
  useDependency,
  useDependencyContext,
  useDependencyContextValue,
  useDependencyValue,
  useObservable,
  useUpdateBinder,
} from '@wendellhu/redi/react-bindings'
import React, { Component, useState } from 'react'
import { BehaviorSubject, interval, of, Subject } from 'rxjs'

import { scan, startWith } from 'rxjs/operators'
import { afterEach, describe, expect, it } from 'vitest'

import { TEST_ONLY_clearKnownIdentifiers } from '../src/decorators'
import { expectToThrow } from './util/expectToThrow'

describe('test legacy rxjs utils', () => {
  afterEach(() => {
    TEST_ONLY_clearKnownIdentifiers()
  })

  it('should demo works with RxJS', async () => {
    class CounterService {
      counter$ = interval(100).pipe(
        startWith(0),
        scan(acc => acc + 1),
      )
    }

    const App = connectDependencies(
      class extends Component {
        override render() {
          return <Display />
        }
      },
      [[CounterService]],
    )

    function Display() {
      const counter = useDependency(CounterService)
      const value = useDependencyValue(counter!.counter$, 0)

      return <div>{value}</div>
    }

    const { container } = render(<App />)
    expect(container.firstChild!.textContent).toBe('0')

    await act(
      () => new Promise<undefined>(res => setTimeout(() => res(void 0), 360)),
    )
    expect(container.firstChild!.textContent).toBe('3')
  })

  it('should use default value in BehaviorSubject', async () => {
    class CounterService implements IDisposable {
      public counter$: BehaviorSubject<number>
      private number: number
      private readonly loop?: number

      constructor() {
        this.number = 5
        this.counter$ = new BehaviorSubject(this.number)
        this.loop = setInterval(() => {
          this.number += 1
          this.counter$.next(this.number)
        }, 100) as any as number
      }

      dispose(): void {
        clearTimeout(this.loop!)
      }
    }

    const App = connectDependencies(
      () => {
        return <Child />
      },
      [[CounterService]],
    )

    function Child() {
      const counterService = useDependency(CounterService)
      const count = useDependencyValue(counterService.counter$)

      return <div>{count}</div>
    }

    const { container } = render(<App />)
    expect(container.firstChild!.textContent).toBe('5')

    await act(
      () => new Promise<undefined>(res => setTimeout(() => res(void 0), 320)),
    )
    expect(container.firstChild!.textContent).toBe('8')
  })

  it('should not trigger unnecessary re-render when handled correctly', async () => {
    let childRenderCount = 0

    class CounterService {
      counter$ = interval(100).pipe(
        startWith(0),
        scan(acc => acc + 1),
      )
    }

    const App = connectDependencies(
      () => {
        return <Parent />
      },
      [[CounterService]],
    )

    function Parent() {
      const counterService = useDependency(CounterService)
      const count = useDependencyValue(counterService.counter$, 0)

      return <Child count={count} />
    }

    function Child(props: { count?: number }) {
      childRenderCount += 1
      return <div>{props.count}</div>
    }

    const { container } = render(<App />)
    expect(container.firstChild!.textContent).toBe('0')
    expect(childRenderCount).toBe(1)

    await act(
      () => new Promise<undefined>(res => setTimeout(() => res(void 0), 360)),
    )
    expect(container.firstChild!.textContent).toBe('3')
    expect(childRenderCount).toBe(2)
  })

  it('should not trigger unnecessary re-render with useDependencyContext', async () => {
    let childRenderCount = 0

    class CounterService {
      counter$ = interval(100).pipe(
        startWith(0),
        scan(acc => acc + 1),
      )
    }

    const App = connectDependencies(
      () => {
        return <Parent />
      },
      [[CounterService]],
    )

    function useCounter$() {
      return useDependency(CounterService).counter$
    }

    function Parent() {
      const counter$ = useCounter$()
      const { Provider: CounterProvider } = useDependencyContext(counter$, 0)

      return (
        <CounterProvider>
          <Child />
        </CounterProvider>
      )
    }

    function Child() {
      const counter$ = useCounter$()
      const count = useDependencyContextValue(counter$)

      childRenderCount += 1

      return <div>{count}</div>
    }

    const { container } = render(<App />)
    expect(container.firstChild!.textContent).toBe('0')
    expect(childRenderCount).toBe(1)

    await act(
      () => new Promise<undefined>(res => setTimeout(() => res(void 0), 360)),
    )
    expect(childRenderCount).toBe(2)
  })

  it('should raise error when no ancestor subscribe an observable value', async () => {
    class CounterService {
      counter$ = interval(1000).pipe(
        startWith(0),
        scan(acc => acc + 1),
      )
    }

    const App = connectDependencies(
      () => {
        return <Parent />
      },
      [[CounterService]],
    )

    function useCounter$() {
      return useDependency(CounterService).counter$
    }

    function Parent() {
      return <Child />
    }

    function Child() {
      const counter$ = useCounter$()
      const count = useDependencyContextValue(counter$)

      return <div>{count}</div>
    }

    expectToThrow(
      () => render(<App />),
      '[redi]: try to read context value but no ancestor component subscribed it.',
    )
  })

  it('should update whenever `useUpdateBinder` emits', async () => {
    class CounterService implements IDisposable {
      public number = 0
      public updater$ = new Subject<void>()

      private loop?: number

      constructor() {
        this.loop = setInterval(() => {
          this.number += 1
          this.updater$.next()
        }, 100) as any as number
      }

      dispose(): void {
        clearTimeout(this.loop!)
      }
    }

    const App = connectDependencies(
      () => {
        return <Child />
      },
      [[CounterService]],
    )

    function Child() {
      const counterService = useDependency(CounterService)

      useUpdateBinder(counterService.updater$)

      return <div>{counterService.number}</div>
    }

    const { container } = render(<App />)
    expect(container.firstChild!.textContent).toBe('0')

    await act(
      () => new Promise<undefined>(res => setTimeout(() => res(void 0), 310)),
    )
    expect(container.firstChild!.textContent).toBe('3')
  })
})

describe('test "useObservable"', () => {
  it('should return undefined when no initial value is provided', () => {
    const observable: Observable<boolean> | undefined = undefined

    const { result } = renderHook(() => useObservable<boolean>(observable))
    expect(result.current).toBeUndefined()
  })

  it('should return the initial value when provided', () => {
    const observable: Observable<boolean> | undefined = undefined

    const { result } = renderHook(() => useObservable<boolean>(observable, true))
    expect(result.current).toBeTruthy()
  })

  it('should return the initial value when provided synchronously', () => {
    const observable: Observable<boolean> = of(true)

    const { result } = renderHook(() => useObservable<boolean>(observable))
    expect(result.current).toBeTruthy()
  })

  function useTestUseObservableBed() {
    const observable = new Subject<boolean>()
    const result = useObservable(observable, undefined)

    return {
      observable,
      result,
    }
  }

  it('should emit new value when observable emits', () => {
    const { result } = renderHook(() => useTestUseObservableBed())

    expect(result.current.result).toBeUndefined()

    act(() => result.current.observable.next(true))
    expect(result.current.result).toBeTruthy()

    act(() => result.current.observable.next(false))
    expect(result.current.result).toBeFalsy()
  })

  function useTestSwitchObservableBed() {
    const [observable, setObservable] = useState<Observable<boolean> | undefined>(undefined)
    const result = useObservable(observable)

    return {
      result,
      observable,
      setObservable,
    }
  }

  it('should emit when passing new observable to the hook', () => {
    const { result } = renderHook(() => useTestSwitchObservableBed())

    expect(result.current.result).toBeUndefined()

    act(() => result.current.setObservable(of(true)))
    expect(result.current.result).toBeTruthy()

    act(() => result.current.setObservable(of(false)))
    expect(result.current.result).toBeFalsy()
  })

  it('should support a callback function returns an observable', () => {
    // const { result } = renderHook(() => useObservable(() => of(true)));
    // This line above would cause infinite look. Pass `deps` to fix the problem.
    const { result } = renderHook(() => useObservable(() => of(true), undefined, true, []))

    expect(result.current).toBeTruthy()
  })
})
