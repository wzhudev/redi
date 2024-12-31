# redi

![Stars](https://badgen.net/github/stars/wzhudev/redi)
![Downloads](https://badgen.net/npm/dt/@wendellhu/redi)
![License](https://badgen.net/github/license/wzhudev/redi)
[![Codecov](https://img.shields.io/codecov/c/github/wzhudev/redi.svg)](https://codecov.io/gh/wzhudev/redi)

A dependency library for TypeScript and JavaScript, along with a binding for React.

## Overview

```typescript
import { Inject } from '@wendellhu/redi'

class AuthService {
  public getCurrentUserInfo(): UserInfo {}
}

class FileListService {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  public getUserFiles(): Promise<Files> {
    const currentUser = this.authService.getCurrentUserInfo()
  }
}

const injector = new Injector([[AuthService], [FileListService]])

injector.get(AuthService)
```

**View full documentation on [redi.wzhu.dev](https://redi.wzhu.dev/).**

## Links

-   [Demo TodoMVC](https://wzhudev.github.io/redi-todomvc/) | [source](https://github.com/wzhudev/redi-todomvc)
-   [Scaffold](https://github.com/wzhudev/redi-starter)

## Users

-   [Univer](https://github.com/dream-num/univer)
-   Team Lark at ByteDance

## License

MIT. Copyright 2021-present Wenzhao Hu.
