# redi

A dependency library for TypeScript and JavaScript, along with a binding for React.

## What's This?

**redi** (pronounced 'ready') is a dependency injection library for TypeScript (& JavaScript with some babel config). It also provides a set of bindings to let you adopt the pattern in your React applications.

-   redi is completely opt-in. Unlike Angular, redi let you decide when and where to use dependency injection.
-   redi provides a multi-layered dependency injection system.
-   redi supports multi kinds of injection items, including classes, instances, and factories.
-   redi supports advanced features such as async injection item, lazy instantiation to boot your application's performance.

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

import { Inject } from '@wendellhu/redi'

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

Then you don't instantiate a `FileListService` by yourself. You get a `FileListService` from the injector you just created.

Step 3. Get a dependency.

```typescript
const fileListService = injector.get(FileListService)
```

That's it!
