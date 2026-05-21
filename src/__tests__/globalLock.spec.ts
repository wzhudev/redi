import { describe, expect, it } from 'bun:test';
import { acquireGlobalLock, detectGlobalEnv } from '../globalLock';

describe('globalLock', () => {
  it('sets the lock the first time and returns true', () => {
    const globalObject: Record<string, unknown> = {};
    let warned: string | undefined;
    const acquired = acquireGlobalLock('LOCK', 'duplicate!', {
      globalObject,
      isNode: false,
      warn: (m) => {
        warned = m;
      },
    });

    expect(acquired).toBe(true);
    expect(globalObject.LOCK).toBe(true);
    expect(warned).toBeUndefined();
  });

  it('warns and returns false in browsers when already locked', () => {
    const globalObject: Record<string, unknown> = { LOCK: true };
    let warned: string | undefined;
    const acquired = acquireGlobalLock('LOCK', 'duplicate!', {
      globalObject,
      isNode: false,
      warn: (m) => {
        warned = m;
      },
    });

    expect(acquired).toBe(false);
    expect(warned).toBe('duplicate!');
  });

  it('stays silent in Node when already locked', () => {
    const globalObject: Record<string, unknown> = { LOCK: true };
    let warned: string | undefined;
    const acquired = acquireGlobalLock('LOCK', 'duplicate!', {
      globalObject,
      isNode: true,
      warn: (m) => {
        warned = m;
      },
    });

    expect(acquired).toBe(false);
    expect(warned).toBeUndefined();
  });

  it('detectGlobalEnv returns a usable environment', () => {
    const env = detectGlobalEnv();
    expect(env.globalObject).toBeDefined();
    expect(typeof env.isNode).toBe('boolean');
    expect(typeof env.warn).toBe('function');
  });
});
