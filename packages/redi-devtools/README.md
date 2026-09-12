# `@wendellhu/redi-devtools`

Developer tools for inspecting live `@wendellhu/redi` Dependency Graphs.
Importing the package is inert: it does not mount UI, start polling, or install
global listeners.

## Requirements

- `@wendellhu/redi` >= 1.2.0 and < 2.0.0
- React and React DOM >= 18.0.0

Install the debugger as a development dependency and provide its peers in the
application:

```bash
bun add --dev @wendellhu/redi-devtools
```

## Embeddable Panel

```tsx
import { DebuggerPanel } from '@wendellhu/redi-devtools';
import '@wendellhu/redi-devtools/style.css';

export function DebugPage() {
  return <DebuggerPanel pollInterval={2000} style={{ height: 600 }} />;
}
```

Set `pollInterval={false}` to disable automatic refresh; the Panel's Refresh
button remains available. The root switch lists only parentless Injectors and
shows one complete Injector tree at a time.

## Overlay setup

Call setup explicitly when a debug shell should be auto-mounted:

```ts
import { setupDebugger } from '@wendellhu/redi-devtools';
import '@wendellhu/redi-devtools/style.css';

const debuggerHandle = setupDebugger({ pollInterval: 2000 });

// Later: unmount React, remove the host node, and stop Panel polling.
debuggerHandle.dispose();
```

`dispose()` is idempotent. You can also pass `container` and `zIndex` to
`setupDebugger()` when the default `document.body` overlay is not appropriate.
Call it only in a browser after the DOM exists (for example, from a client
bootstrap function or React effect); it intentionally throws without a
`document`.
