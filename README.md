# redi

A dependency library for TypeScript and JavaScript, along with a binding for React.

## Features

**redi** (pronounced 'ready') is a dependency injection library for TypeScript (& JavaScript with some babel config). It also provides a set of bindings to let you adopt the pattern in your React applications.

-   **Completely opt-in**. Unlike Angular, redi let you decide when and where to use dependency injection.
-   **Hierarchical dependency tree.**
-   Supports **multi kinds of dependency items**, including
    -   classes
    -   instances
    -   factories
    -   async items
-   Supports **n-ary dependencies**
    -   Required
    -   Optional
    -   Many
-   **Constructor dependencies.**
-   **Forward ref**, to resolve problems rising from cyclic dependency of JavaScript files.
-   **Lazy instantiation**, instantiate a dependency only when they are accessed to boost up performance.

## Getting Started

### Installation

```sh
npm install @wendellhu/redi
```

After installation you need to enable `experimentalDecorators` in your tsconfig.json file.

```diff
{
    "compilerOptions": {
+       "experimentalDecorators": true
    }
}
```

### Basics

Let's get started with a real-word example:

```typescript
class AuthService {
    static public getCurrentUserInfo(): UserInfo {
        // your implementation here...
    }
}

class FileListService {
    constructor() {}

    public getUserFiles(): Promise<Files> {
        const currentUser = // ...AuthService.getCurrentUserInfo()
        // ...
    }
}
```

It is clearly that `FileListServices` dependents on `AuthService`, so you just need to declare it on the constructor of `FileListService`.

Step 1. Declare dependency relationship.

```diff
class AuthService {
    public getCurrentUserInfo(): UserInfo {
        // your implementation here...
    }
}

+ import { Inject } from '@wendellhu/redi'

class FileListService {
-   constructor() {}
+   constructor(@Inject(AuthService) private readonly authService: AuthService) {}

    public getUserFiles(): Promise<Files> {
-       const currentUser = // ...AuthService.getCurrentUserInfo()
+       const currentUser = this.authService.getCurrentUserInfo()
        // ...
    }
}
```

Then you need to include all things into an `Injector`.

Step 2. Provide dependencies.

```typescript
import { Injector } from '@wendellhu/redi'

const injector = new Injector([[FileListService], [AuthService]])
```

You don't instantiate a `FileListService` by yourself. You get a `FileListService` from the injector just created.

Step 3. Wire up!

```typescript
const fileListService = injector.get(FileListService)
```

That's it!

### React Bindings

redi provides a set of React bindings in it's secondary entry point `@wendellhu/redi/react-bindings` that can help you use it in your React application easily.

```tsx
import { withDependencies } from '@wendellhu/redi/react-bindings'

const App = withDependencies(
    function AppImpl() {
        const injector = useInjector()
        const fileListService = injector.get(FileListService)
        // ...
    },
    [[FileListService], [AuthService]]
)
```

## Concepts

-   The **injector** holds a set of bindings and resolves dependencies.
-   A **binding** maps a token to a dependency item.
    -   Token works as an identifier. It differentiate a dependency from another. It could be the return value of `createIdentifier`, or a class.
    -   Dependency could be
        -   a class
        -   an instance or value
        -   a factory function
        -   an async item, which would be resoled to an other kind of dependency later
-   Dependency could declare its own dependencies, and contains extra information on how its dependencies should be injected, and contains extra information on how its dependencies should be injected.

## API

### Decorators

**`createIdentifier`**

```ts
function createIdentifier<T>(id: string): IdentifierDecorator<T>
```

Create a token that could identify a dependency. The token could be used as an decorator to declare dependencies.

```ts
import { createIdentifier } from '@wendellhu/redi'

interface IPlatformService {
    copy(): Promise<boolean>
}

const IPlatformService = createIdentifier<IPlatformService>()

class Editor {
    constructor(@IPlatformService private readonly ipfs: IPlatformService) {}
}
```

**`Inject Many Optional`**

-   `Inject` marks the parameter as being a required dependency. By default, token returned from `createIdentifier` marks the parameter as required as well.
-   `Many` marks the parameter and being a n-ary dependency.
-   `Optional` marks the parameter as being an optional dependency.

```ts
class MobileEditor {
    constructor(
        @Inject(SoftKeyboard) private readonly softKeyboard: SoftKeyboard,
        @Many(Menu) private readonly menus: Menu[],
        @Optional(IPlatformService) private readonly ipfs?: IPlatformService
    ) {}
}
```

**`Self SkipSelf`**

-   `Self` marks that the parameter should only be resolved by the current injector.
-   `SkipSelf` marks that parameter should be resolved from the current injector's parent.

```ts
import { Self, SkipSelf } from '@wendellhu/redi'

class Person {
    constructor() {
        @Self() @Inject(forwardRef(() => Father)) private readonly father: Father,
        @SkipSelf() @Inject(forwardRef(() => Father)) private readonly grandfather: Father
    }
}

class Father extends Person {}
```

### Dependency Items

**`ClassItem`**

```ts
interface ClassDependencyItem<T> {
    useClass: Ctor<T>
    lazy?: boolean
}
```

-   `useClass` the class
-   `lazy` enable lazy instantiation

**`ValueDependencyItem`**

```ts
export interface ValueDependencyItem<T> {
    useValue: T
}
```

**`FactoryDependencyItem`**

```ts
export interface FactoryDependencyItem<T> {
    useFactory: (...deps: any[]) => T
    deps?: FactoryDep<any>[]
}
```

**`AsyncDependencyItem`**

```ts
export type SyncDependencyItem<T> =
    | ClassDependencyItem<T>
    | FactoryDependencyItem<T>
    | ValueDependencyItem<T>

interface AsyncDependencyItem<T> {
    useAsync: () => Promise<
        T | Ctor<T> | [DependencyIdentifier<T>, SyncDependencyItem<T>]
    >
}
```

### Injector

### `forwardRef`

### Singletons

### React Bindings

## JavaScript

## Best Practices

**Multi webpack entry**

## Motivation

## License

MIT. Copyright 2021 Wendell Hu.
