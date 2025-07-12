# redi

![Stars](https://badgen.net/github/stars/wzhudev/redi)
![Weekly Downloads](https://badgen.net/npm/dw/@wendellhu/redi)
![License](https://badgen.net/github/license/wzhudev/redi)
[![Codecov](https://img.shields.io/codecov/c/github/wzhudev/redi.svg)](https://codecov.io/gh/wzhudev/redi)

A dependency library for TypeScript and JavaScript, along with a binding for React.

## Highlights

- Zero dependencies, lightweight and fast.
- No `emitDecoratorMetadata` required, works in both TypeScript and [**JavaScript**](https://redi.wzhu.dev/en-US/docs/env#using-redi-without-decorators). **[esbuild](https://esbuild.github.io/) friendly.**
- Written in **TypeScript** with type definitions included.
- Runs on **Node.js** and **browsers**.
- Feature-rich:
  - Injecting **class instances** `{ useClass: <ctor> }`, **primitive values** `{ useValue: <value> }`, **factories** `{ useFactory: <factoryFn> }` and **aliases** `{ useExisting: <token> }`.
  - Injecting **interfaces** with `createIdentifier`.
  - **Lazy instantiation** with `{ useClass: <ctor>, lazy: true }`.
  - **Async dependency** with `{ useAsync: <Promise> }`, `getAsync` and `AsyncHook`.
  - **Optional and multi-injection** with `@Optional()` and `@Many()`.
  - **Hierarchical injectors** with `@Self()` and `@SkipSelf()`.
- Provide hooks to integrate with React `useDependency(<token>)`.
- Sufficiently tested with **100% code coverage**.

## Installation

Use your favorite package manager:

```bash
npm install @wendellhu/redi
```

## Usage (TypeScript)

Enable experimental decorators in your `tsconfig.json`:

```diff
{
  "compilerOptions": {
+   "experimentalDecorators": true,
  }
}
```

Then you can use decorators to define dependencies:

```typescript
import { Inject } from '@wendellhu/redi';

class AuthService {
  public getCurrentUserInfo(): UserInfo {}
}

class FileListService {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  public getUserFiles(): Promise<Files> {
    const currentUser = this.authService.getCurrentUserInfo();
  }
}
```

Register the services in an injector and retrieve them:

```typescript
import { Injector } from '@wendellhu/redi';

const injector = new Injector([[AuthService], [FileListService]]);
injector.get(AuthService);
```

### With React

Near the root of your React application, you can connect the dependencies to the React context using `connectDependencies`:

```typescript
import { connectDependencies } from '@wendellhu/redi/react';
import React from 'react';
import { PlatformService } from './services/PlatformService';

const App = connectDependencies(() => {
  // ...
}, [[PlatformService]]);
```

In your child components, you can use the `useDependency` hook to access them:

```typescript
import { useDependency } from '@wendellhu/redi';
import React from 'react';
import { PlatformService } from './services/PlatformService';

const MyComponent: React.FC = () => {
  const platformService = useDependency(PlatformService);

  // ...
};
```

## Links

- [Documentation](https://redi.wzhu.dev/en-US/)
- [Demo TodoMVC](https://wzhudev.github.io/redi-todomvc/), and its [source code](https://github.com/wzhudev/redi-todomvc)
- [Scaffold](https://github.com/wzhudev/redi-starter) to quickly start a new project with redi

## Who is using?

- [Univer](https://github.com/dream-num/univer)
- ByteDance

## Contributing

Please read the [contributing guide](./CONTRIBUTING.md) for details on how to contribute to this project.

## License

MIT. Copyright 2021-present Wenzhao Hu.
