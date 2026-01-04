import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Injector } from './injector';

export const REDI_DEVTOOLS_SNAPSHOT = Symbol.for('REDI_DEVTOOLS_SNAPSHOT');
export const REDI_DEVTOOLS_GLOBAL = Symbol.for('REDI_DEVTOOLS_GLOBAL');

interface RediDevtoolsGlobalState {
  version: 1;
  roots: Map<string, Injector>;
}

function isNodeRuntime(): boolean {
  // In Vitest/Jest (even with jsdom), `process.versions.node` is present.
  // We intentionally do NOT auto-track roots in Node to avoid leaking globals in tests/SSR.
  // eslint-disable-next-line node/prefer-global/process
  return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
}

function getOrCreateDevtoolsGlobalState(): RediDevtoolsGlobalState {
  const g = globalThis as any;
  let state = g[REDI_DEVTOOLS_GLOBAL] as RediDevtoolsGlobalState | undefined;
  if (!state) {
    state = { version: 1, roots: new Map() };
    g[REDI_DEVTOOLS_GLOBAL] = state;
  }
  return state;
}

export interface InjectorDevtoolsHook {
  onInjectorCreated?: (injector: Injector, parent: Injector | null) => void;
  onInjectorDisposed?: (injector: Injector) => void;
}

let currentHook: InjectorDevtoolsHook | null = null;

export function setInjectorDevtoolsHook(hook: InjectorDevtoolsHook | null): void {
  currentHook = hook;
}

export function notifyInjectorCreated(injector: Injector, parent: Injector | null): void {
  if (!isNodeRuntime() && parent === null) {
    const state = getOrCreateDevtoolsGlobalState();
    state.roots.set(injector.debugKey, injector);
  }
  currentHook?.onInjectorCreated?.(injector, parent);
}

export function notifyInjectorDisposed(injector: Injector): void {
  if (!isNodeRuntime()) {
    const g = globalThis as any;
    const state = g[REDI_DEVTOOLS_GLOBAL] as RediDevtoolsGlobalState | undefined;
    state?.roots.delete(injector.debugKey);
  }
  currentHook?.onInjectorDisposed?.(injector);
}

export interface DevtoolsInjectorSnapshot {
  id: string;
  name?: string;
  parentId: string | null;
  depth: number;
}

export interface DevtoolsTokenSnapshot {
  key: string;
  injectorId: string;
  tokenId: string;
  label: string;
  instantiated: boolean;
}

export interface DevtoolsEdgeSnapshot {
  from: string;
  to: string;
}

export interface DevtoolsDependencyGraphSnapshot {
  injectors: DevtoolsInjectorSnapshot[];
  tokens: DevtoolsTokenSnapshot[];
  edges: DevtoolsEdgeSnapshot[];
}

export function snapshotDependencyGraph(rootInjector: Injector): DevtoolsDependencyGraphSnapshot {
  const fn = (rootInjector as any)[REDI_DEVTOOLS_SNAPSHOT] as undefined | (() => DevtoolsDependencyGraphSnapshot);
  if (!fn) {
    return { injectors: [], tokens: [], edges: [] };
  }

  return fn.call(rootInjector);
}

export interface DevtoolsGraphTokenNode {
  key: string;
  injectorId: string;
  tokenId: string;
  identifier: DependencyIdentifier<any>;
  label: string;
  instantiated: boolean;
}
