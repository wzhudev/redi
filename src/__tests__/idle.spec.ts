import { describe, expect, it } from 'bun:test';
import { wait } from '../__testing__/timer';
import { createRunWhenIdle, IdleValue } from '../idleValue';

describe('test idle', () => {
  it('should run when idle', () => {
    const executor = () => 42;
    const idleValue = new IdleValue(executor);

    expect(idleValue.hasRun()).toBe(false);
    expect(idleValue.getValue()).toBe(42);
    expect(idleValue.hasRun()).toBe(true);
  });

  it('should throw error if executor throws', () => {
    const executor = () => {
      throw new Error('Test error');
    };
    const idleValue = new IdleValue(executor);

    expect(idleValue.hasRun()).toBe(false);
    expect(() => idleValue.getValue()).toThrow('Test error');
    expect(idleValue.hasRun()).toBe(true);
  });

  it('should execute the executor when CPU is idle', async () => {
    const executor = () => {
      return 'Executed when idle';
    };
    const idleValue = new IdleValue(executor);

    expect(idleValue.hasRun()).toBe(false);
    await wait(100);
    expect(idleValue.hasRun()).toBe(true);
  });

  it('can dispose an idle instantiation before it was triggered', async () => {
    let executed = false;
    const executor = () => {
      executed = true;
      return 42;
    };
    const idleValue = new IdleValue(executor);

    expect(idleValue.hasRun()).toBe(false);
    idleValue.dispose();

    await wait(100);
    expect(executed).toBe(false);
    expect(idleValue.getValue()).toBe(42);
    expect(executed).toBe(true);
  });

  describe('createRunWhenIdle', () => {
    it('uses requestIdleCallback when available', () => {
      let scheduled: ((d: any) => void) | undefined;
      let cancelled: number | undefined;
      const runner = createRunWhenIdle({
        requestIdleCallback: (cb) => {
          scheduled = cb;
          return 7;
        },
        cancelIdleCallback: (handle) => {
          cancelled = handle;
        },
      });

      let ran = false;
      const dispose = runner(() => {
        ran = true;
      }, 100);
      scheduled!({ didTimeout: false, timeRemaining: () => 10 });
      expect(ran).toBe(true);

      dispose();
      expect(cancelled).toBe(7);

      // second dispose is a no-op
      cancelled = undefined;
      dispose();
      expect(cancelled).toBeUndefined();
    });

    it('falls back to setTimeout when requestIdleCallback is missing', async () => {
      const runner = createRunWhenIdle({});
      let received: any;
      const dispose = runner((idle) => {
        received = idle;
      });

      await wait(10);
      expect(received?.didTimeout).toBe(true);
      expect(received?.timeRemaining()).toBe(15);

      // disposing after the timer fired is still safe
      dispose();
      dispose();
    });

    it('clears the fallback timer on dispose', async () => {
      const runner = createRunWhenIdle({});
      let ran = false;
      const dispose = runner(() => {
        ran = true;
      });

      dispose();
      await wait(10);
      expect(ran).toBe(false);
    });
  });
});
