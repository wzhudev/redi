# redi

![Stars](https://badgen.net/github/stars/wendellhu95/redi)
![Downloads](https://badgen.net/npm/dt/@wendellhu/redi)
![Codecov](https://badgen.net/github/license/wendellhu95/redi)
[![Codecov](https://img.shields.io/codecov/c/github/wendellhu95/redi.svg)](https://codecov.io/gh/wendellhu95/redi)

A dependency library for TypeScript and JavaScript, along with a binding for React.

## Overview

```typescript
import { Inject } from '@wendellhu/redi'
class AuthService {
    public getCurrentUserInfo(): UserInfo {
        // your implementation here...
    }
}
class FileListService {
    constructor(@Inject(AuthService) private readonly authService: AuthService) {}
    public getUserFiles(): Promise<Files> {
        const currentUser = this.authService.getCurrentUserInfo()
        // ...
    }
}
const injector = new Injector([[AuthService], [FileListService]])
injector.get(AuthService)
```

**View full documentation and examples on [redi.wendell.fun](https://redi.wendell.fun/).**

## Links

* [Demo TodoMVC](https://wendellhu95.github.io/redi-todomvc/) | [source](ttps://github.com/wendellhu95/redi-todomvc)
* Doc site [source](https://github.com/wendellhu95/redi-site)
* [scaffold](https://github.com/wendellhu95/redi-starter)

## License

MIT. Copyright 2021 Wendell Hu.
