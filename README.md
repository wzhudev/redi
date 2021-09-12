# redi

A dependency library for TypeScript and JavaScript, along with a binding for React.

## Features

**redi** (pronounced 'ready') is a dependency injection library for TypeScript (& JavaScript with some babel config). It also provides a set of bindings to let you adopt the pattern in your React applications.

-   **Completely opt-in**. Unlike Angular, redi let you decide when and where to use dependency injection.
-   **Hierarchical dependency tree.**
-   Supports **multi kinds of injection items**, including
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
    public getCurrentUserInfo(): UserInfo {
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

### Dependency Items

### Injector

### React Bindings

## License

MIT. Copyright 2021 Wendell Hu.
