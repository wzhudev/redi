import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { Injector } from '@wendellhu/redi';
import { afterEach, describe, expect, test } from 'bun:test';
import { setupDebugger } from '../overlay';

afterEach(() => {
  cleanup();
});

describe('setupDebugger', () => {
  test('mounts shared Panel controls and clears polling when closed', async () => {
    const injector = new Injector();
    const container = document.createElement('div');
    document.body.appendChild(container);
    let handle: ReturnType<typeof setupDebugger> | undefined;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    let intervalCalls = 0;
    let clearCalls = 0;
    window.setInterval = (() => {
      intervalCalls += 1;
      return 8675309;
    }) as unknown as typeof window.setInterval;
    window.clearInterval = ((id: number) => {
      if (id === 8675309) clearCalls += 1;
    }) as typeof window.clearInterval;

    try {
      await act(async () => {
        handle = setupDebugger({
          container,
          pollInterval: 25,
          zIndex: 1234,
        });
      });

      expect(
        container.querySelector('[data-redi-devtools-overlay]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-redi-devtools-panel]'),
      ).not.toBeNull();
      expect(
        container.querySelector<HTMLElement>(
          '[data-redi-devtools-overlay-window]',
        )?.style.zIndex,
      ).toBe('1234');
      expect(intervalCalls).toBe(1);

      fireEvent.click(
        screen.getByRole('button', { name: 'Collapse debugger' }),
      );
      expect(clearCalls).toBe(1);
      fireEvent.click(screen.getByRole('button', { name: 'Expand debugger' }));
      expect(intervalCalls).toBe(2);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close debugger' }));
        await Promise.resolve();
      });
      expect(clearCalls).toBe(2);
      handle?.dispose();
      expect(container.children).toHaveLength(0);
    } finally {
      handle?.dispose();
      window.setInterval = originalSetInterval;
      window.clearInterval = originalClearInterval;
      container.remove();
      injector.dispose();
    }
  });

  test('rejects setup when no DOM document exists', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => setupDebugger()).toThrow(
        'setupDebugger() requires a DOM document.',
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'document', descriptor);
      }
    }
  });
});
