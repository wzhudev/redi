# redi

<p className="flex h-6">
  <img
    alt="stars"
    src="https://badgen.net/github/stars/wzhudev/redi"
    style={{ display: "inline-block", marginRight: "0.5rem" }}
  />
  <img
    alt="downloads"
    src="https://badgen.net/npm/dw/@wendellhu/redi"
    style={{ display: "inline-block", marginRight: "0.5rem" }}
  />
  <img
    alt="license"
    src="https://badgen.net/github/license/wzhudev/redi"
    style={{ display: "inline-block", marginRight: "0.5rem" }}
  />
  <img
    alt="coverage"
    src="https://img.shields.io/codecov/c/github/wzhudev/redi.svg"
    style={{ display: "inline-block" }}
  />
</p>

**redi** (pronounced 'ready') is a lightweight dependency injection library for TypeScript and JavaScript, with React bindings included.

## Why redi?

| Feature                 | Description                                     |
| ----------------------- | ----------------------------------------------- |
| 🪶 **Lightweight**      | Zero dependencies, small bundle size            |
| 🔧 **esbuild friendly** | No `emitDecoratorMetadata` required             |
| 📦 **Feature-rich**     | Class, value, factory, async injection and more |
| ⚛️ **React ready**      | Built-in hooks for React integration            |
| ✅ **Well tested**      | 100% code coverage                              |

## Quick Start

```bash npm2yarn
npm install @wendellhu/redi
```

```ts
import { Inject, Injector } from '@wendellhu/redi';

class AuthService {
  getCurrentUserInfo(): UserInfo {
    /* ... */
  }
}

class FileListService {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  getUserFiles(): Promise<Files> {
    const user = this.authService.getCurrentUserInfo();
    // ...
  }
}

const injector = new Injector([[AuthService], [FileListService]]);
const fileList = injector.get(FileListService);
```

**[Getting started](https://redi.wzhu.dev/docs/introduction)**.

## Features

- **[Dependency Items](https://redi.wzhu.dev/docs/item)**: Class `{ useClass }`, Value `{ useValue }`, Factory `{ useFactory }`, Async `{ useAsync }`
- **[Interface Injection](https://redi.wzhu.dev/docs/identifier)**: Use `createIdentifier` for interface-based injection
- **[Lazy Instantiation](https://redi.wzhu.dev/docs/item)**: Defer creation with `{ lazy: true }`
- **[Hierarchy Injection](https://redi.wzhu.dev/docs/hierarchy)**: Parent-child injectors with `@Self()` and `@SkipSelf()`
- **[Optional & Many](https://redi.wzhu.dev/docs/declare-dependency)**: `@Optional()` and `@Many()` decorators
- **[React Integration](https://redi.wzhu.dev/docs/react)**: `useDependency`, `connectDependencies` and more hooks
- **[RxJS Support](https://redi.wzhu.dev/docs/react)**: `useObservable` and `useUpdateBinder` for reactive programming

## Performance

redi is performant.

Cached resolution is a map lookup that stays in the tens-of-nanoseconds range
regardless of graph size. Cold resolution is linear in the number of
dependencies and paid once, then amortized by singleton caching.

Indicative numbers from `bun run bench` (Bun, median; machine-specific):

| Scenario                                    |                    Throughput |   Per operation |
| :------------------------------------------ | ----------------------------: | --------------: |
| Cached `get()`                              |                 ~45–52M ops/s |       ~37–39 ns |
| First `get()` — deep chain 10 / 50 / 100    | ~0.87M / 0.16M / 0.074M ops/s | ~2 / 11 / 25 µs |
| First `get()` — wide graph 50 / 200         |         ~0.17M / 0.042M ops/s |     ~12 / 49 µs |
| Parent-injector lookup, depth 5             |                    ~13M ops/s |         ~193 ns |
| `createInstance()` with a cached dependency |                    ~17M ops/s |         ~105 ns |

The suite also covers hierarchy, factories, `@WithNew`, `lazy`, async and
`@Many`; see [`bench/README.md`](./bench/README.md). Use `bun run bench` to run
it and `bun run bench:compare` for regression checks.

**Key takeaways**

- DI overhead is not perceptible in realistic applications. Project size only
  affects the one-time cold start: ~0.25 ms for 1,000 dependency edges and
  ~2.5 ms for 10,000.
- At 60 fps you would need over 100,000 of resolutions per frame to
  become a bottleneck; typical components call `useDependency` tens to hundreds
  of times per render.

## Who's Using redi?

- [Univer](https://github.com/dream-num/univer)
- ByteDance

## Links

- [Demo TodoMVC](https://wzhudev.github.io/redi-todomvc/) ([source](https://github.com/wzhudev/redi-todomvc))
- [Starter Template](https://github.com/wzhudev/redi-starter)
- [Contributing Guide](https://github.com/wzhudev/redi/blob/main/CONTRIBUTING.md)

## License

MIT. Copyright 2021-present Wenzhao Hu.
