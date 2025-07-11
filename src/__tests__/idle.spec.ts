import { describe, expect, it } from 'vitest';
import { wait } from '../__testing__/timer';
import { IdleValue } from '../idleValue';

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
});
