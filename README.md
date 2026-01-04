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

## Visualize Dependency Graph (DAG)

redi can export a dependency graph snapshot after (or before) instantiation.

```ts
import { Inject, Injector } from '@wendellhu/redi';

class C {}
class B {
  constructor(@Inject(C) public readonly c: C) {}
}
class A {
  constructor(@Inject(B) public readonly b: B) {}
}

const injector = new Injector([[A], [B], [C]]);

// Create instances (optional). The snapshot marks instantiated nodes.
injector.get(A);

// 1) JSON snapshot (for custom renderers / tooling)
const graph = injector.snapshotDependencyGraph({ roots: [A] });
console.log(graph.nodes, graph.edges);

// 2) Graphviz DOT output (copy/paste to Graphviz / vscode-graphviz / web viewers)
console.log(injector.toDependencyGraphDot({ roots: [A] }));
```

Notes:

- Edge direction is `from -> to` meaning "from depends on to".
- For hierarchical injectors, the graph points to the provider injector node.

## Who's Using redi?

- [Univer](https://github.com/dream-num/univer)
- ByteDance

## Links

- [Demo TodoMVC](https://wzhudev.github.io/redi-todomvc/) ([source](https://github.com/wzhudev/redi-todomvc))
- [Starter Template](https://github.com/wzhudev/redi-starter)
- [Contributing Guide](https://github.com/wzhudev/redi/blob/main/CONTRIBUTING.md)

## License

MIT. Copyright 2021-present Wenzhao Hu.
