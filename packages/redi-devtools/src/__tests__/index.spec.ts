import { describe, expect, test } from 'bun:test';

describe('@wendellhu/redi-devtools package entry', () => {
  test('exports its stable package identity without mounting UI', async () => {
    const devtoolsNodesBeforeImport = document.querySelectorAll(
      '[data-redi-devtools-overlay], [data-redi-devtools-panel]',
    ).length;
    const originalSetInterval = window.setInterval;
    let intervalCalls = 0;
    window.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
      intervalCalls += 1;
      return originalSetInterval(...args);
    }) as typeof window.setInterval;

    try {
      const entry = await import('../index');

      expect(entry.REDI_DEVTOOLS_PACKAGE_NAME).toBe('@wendellhu/redi-devtools');
    } finally {
      window.setInterval = originalSetInterval;
    }
    expect(
      document.querySelectorAll(
        '[data-redi-devtools-overlay], [data-redi-devtools-panel]',
      ),
    ).toHaveLength(devtoolsNodesBeforeImport);
    expect(intervalCalls).toBe(0);
  });
});
