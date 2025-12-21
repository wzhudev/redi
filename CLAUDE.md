# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

redi is a lightweight dependency injection library for TypeScript and JavaScript with React bindings. It provides feature-rich DI capabilities without requiring `emitDecoratorMetadata`, making it esbuild-friendly.

## Development Commands

```bash
# Testing
pnpm test                    # Run all tests with vitest
pnpm coverage                # Run tests with coverage report
pnpm watch                   # Run tests in watch mode

# Building
pnpm build                   # Build the library using rolldown

# Linting & Formatting
pnpm lint                    # Check code with eslint
pnpm lint:fix                # Fix linting issues automatically
pnpm prettier                # Format code with prettier

# Documentation (in docs/ subdirectory)
pnpm dev:doc                 # Start docs dev server
pnpm build:doc               # Build documentation site

# Release
pnpm release                 # Publish new version (uses release-it)
```

## Architecture

### Core DI System

The DI system is built around several key concepts:

1. **Injector** (`src/injector.ts`): The main container that resolves and caches dependencies. Supports:
   - Hierarchical injectors (parent-child relationships)
   - Lazy instantiation via `IdleValue`
   - Async dependencies with `getAsync()`
   - Circular dependency detection

2. **Dependency Types** (`src/dependencyItem.ts`):
   - `ClassDependencyItem`: `{ useClass: SomeClass, lazy?: boolean }`
   - `ValueDependencyItem`: `{ useValue: someValue }`
   - `FactoryDependencyItem`: `{ useFactory: fn, deps?: [...] }`
   - `ExistingDependencyItem`: `{ useExisting: token }` (aliases)
   - `AsyncDependencyItem`: `{ useAsync: promise }`

3. **Decorators** (`src/decorators.ts`, `src/dependencyQuantity.ts`, `src/dependencyLookUp.ts`):
   - `@Inject(Token)`: Explicit injection
   - `@Optional()`: Allows null if not found
   - `@Many()`: Injects array of all matching dependencies
   - `@Self()`: Only look in current injector
   - `@SkipSelf()`: Skip current injector, look in parents
   - `@WithNew()`: Force new instance creation

4. **Dependency Collection** (`src/dependencyCollection.ts`):
   - Stores unresolved dependencies
   - Manages resolution stack for error reporting
   - Tracks whether dependencies have been resolved (prevents late additions)

5. **Identifiers** (`src/dependencyIdentifier.ts`):
   - Use `createIdentifier<T>(name)` for interface tokens
   - Classes can be used directly as tokens

### React Integration

Located in `src/react-bindings/`:

- **Context** (`reactContext.tsx`): Provides `RediContext`, `RediProvider`, `RediConsumer`
- **Hooks** (`reactHooks.tsx`): `useDependency<T>(token)` and `useInjector()`
- **Higher-Order Component** (`reactComponent.tsx`): `connectDependencies(() => <App />, dependencies)`
- **RxJS Integration** (`reactRx.tsx`): `useObservable()` for reactive state

### Build System

- Uses **rolldown** (rolldown.config.ts) to build ESM, CJS, and UMD bundles
- Separate entry points: main library and `react-bindings` subpath
- Type definitions generated via `rolldown-plugin-dts`
- Outputs to `dist/` with sourcemaps

### Testing

- Tests in `src/__tests__/` use vitest
- `src/__testing__/` contains test utilities and fixtures
- Coverage requirement: 100% (enforced via CI)
- Test helper: `expectToThrow()` for error assertions

## Code Patterns

### Defining a Service

```typescript
class MyService {
  constructor(@Inject(OtherService) private other: OtherService) {}
}
```

### Registering Dependencies

```typescript
const injector = new Injector([
  [MyService],
  [OtherService, { useClass: OtherServiceImpl }],
  [IConfig, { useValue: configObject }],
]);
```

### Using with React

```typescript
// Wrap app
const App = connectDependencies(() => <MyApp />, [[MyService]]);

// In components
const MyComponent = () => {
  const service = useDependency(MyService);
  // ...
};
```

### Creating Interface Tokens

```typescript
const ILogger = createIdentifier<Logger>('ILogger');
injector.add([ILogger, { useClass: ConsoleLogger }]);
```

## Important Notes

- **experimentalDecorators must be enabled** in tsconfig.json
- **NO `emitDecoratorMetadata` required** - explicitly use `@Inject()` decorator
- Uses **pnpm** as package manager (node >= 22.12.0)
- **lint-staged** runs on pre-commit via husky
- Documentation site uses Nextra and is in the `docs/` subdirectory
- When modifying core logic, ensure tests maintain 100% coverage
