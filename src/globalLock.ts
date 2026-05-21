/* eslint-disable node/prefer-global/process */

export interface GlobalLockEnv {
  globalObject: Record<string, unknown>;
  isNode: boolean;
  warn: (message: string) => void;
}

export function detectGlobalEnv(): GlobalLockEnv {
  const globalObject: any =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof window !== 'undefined' && window) ||
    // eslint-disable-next-line no-restricted-globals
    (typeof global !== 'undefined' && global);

  const isNode =
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null;

  return {
    globalObject,
    isNode,
    warn: (message) => console.error(message),
  };
}

export function acquireGlobalLock(
  key: string,
  duplicateMessage: string,
  env: GlobalLockEnv = detectGlobalEnv(),
): boolean {
  if (env.globalObject[key]) {
    if (!env.isNode) {
      env.warn(duplicateMessage);
    }
    return false;
  }

  env.globalObject[key] = true;
  return true;
}
