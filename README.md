# redi

![Stars](https://badgen.net/github/stars/hullis/redi)
![Downloads](https://badgen.net/npm/dt/@wendellhu/redi)
![License](https://badgen.net/github/license/hullis/redi)
[![Codecov](https://img.shields.io/codecov/c/github/hullis/redi.svg)](https://codecov.io/gh/hullis/redi)

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

**View full documentation on [redi.wendell.fun](https://redi.wendell.fun/).**

## Links

-   [Demo TodoMVC](https://hullis.github.io/redi-todomvc/) | [source](https://github.com/hullis/redi-todomvc)
-   Doc site [source](https://github.com/hullis/redi-site)
-   [scaffold](https://github.com/hullis/redi-starter)

## Users

-   Team Lark at ByteDance

## License

MIT. Copyright 2021-2022 Wendell Hu.
