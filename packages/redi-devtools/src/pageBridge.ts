import type { DevtoolsDependencyGraphSnapshot, Injector, InjectorDevtoolsHook } from '@wendellhu/redi';
import { setInjectorDevtoolsHook, snapshotDependencyGraph } from '@wendellhu/redi';

export interface RediDevtoolsSnapshot {
  roots: DevtoolsDependencyGraphSnapshot[];
}

export interface RediDevtoolsBridge {
  getSnapshot: () => RediDevtoolsSnapshot;
  subscribe: (listener: () => void) => () => void;
  uninstall: () => void;
}

const BRIDGE_SYMBOL = Symbol.for('REDI_DEVTOOLS_BRIDGE');

function getGlobalObject(): any {
  // eslint-disable-next-line no-restricted-globals
  return (typeof globalThis !== 'undefined' && globalThis) || (typeof window !== 'undefined' && window) || global;
}

export function installRediDevtoolsBridge(): RediDevtoolsBridge {
  const g = getGlobalObject();
  if (g[BRIDGE_SYMBOL]) {
    return g[BRIDGE_SYMBOL] as RediDevtoolsBridge;
  }

  const roots = new Map<string, Injector>();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  const hook: InjectorDevtoolsHook = {
    onInjectorCreated(injector, parent) {
      if (parent === null) {
        roots.set(injector.debugKey, injector);
        emit();
      }
    },
    onInjectorDisposed(injector) {
      if (roots.delete(injector.debugKey)) {
        emit();
      }
    },
  };

  setInjectorDevtoolsHook(hook);

  const bridge: RediDevtoolsBridge = {
    getSnapshot: () => {
      return {
        roots: Array.from(roots.values()).map((r) => snapshotDependencyGraph(r)),
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    uninstall: () => {
      listeners.clear();
      roots.clear();
      setInjectorDevtoolsHook(null);
      delete g[BRIDGE_SYMBOL];
    },
  };

  g[BRIDGE_SYMBOL] = bridge;
  return bridge;
}
