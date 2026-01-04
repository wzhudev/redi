import type { DevtoolsDependencyGraphSnapshot } from '@wendellhu/redi';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RediGraph } from '../src/panel/RediGraph';

/// <reference types="chrome" />

type EvalResult = DevtoolsDependencyGraphSnapshot[] | null;

function evalSnapshot(): Promise<EvalResult> {
  return new Promise((resolve) => {
    const expression = `(() => {
      try {
        const globalSym = Symbol.for('REDI_DEVTOOLS_GLOBAL');
        const state = globalThis[globalSym];
        if (!state || !state.roots) return null;

        const roots = Array.from(state.roots.values());
        const snapSym = Symbol.for('REDI_DEVTOOLS_SNAPSHOT');

        const snaps = roots
          .map((r) => {
            const fn = r && r[snapSym];
            return typeof fn === 'function' ? fn.call(r) : null;
          })
          .filter(Boolean);

        return snaps.length ? snaps : null;
      } catch (e) {
        return null;
      }
    })()`;

    chrome.devtools.inspectedWindow.eval(
      expression,
      (result: unknown, exceptionInfo: chrome.devtools.inspectedWindow.EvaluationExceptionInfo) => {
      if (exceptionInfo && exceptionInfo.isException) {
        resolve(null);
        return;
      }

      resolve((result ?? null) as EvalResult);
      },
    );
  });
}

function App() {
  const [roots, setRoots] = useState<DevtoolsDependencyGraphSnapshot[] | null>(null);
  const prevRootsRef = useRef<DevtoolsDependencyGraphSnapshot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const tick = async () => {
      const next = await evalSnapshot();
      if (!cancelled) {
        // 深度比较，只有数据真正变化时才更新
        const hasChanged = !prevRootsRef.current ||
          !next ||
          prevRootsRef.current.length !== next.length ||
          JSON.stringify(prevRootsRef.current) !== JSON.stringify(next);

        if (hasChanged) {
          setRoots(next);
          prevRootsRef.current = next;
        }
      }
    };

    const debouncedTick = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(tick, 1000); // 防抖1秒
    };

    debouncedTick();
    const id = window.setInterval(debouncedTick, 2000); // 每2秒检查一次，而不是500ms

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(id);
    };
  }, []);

  if (!roots || roots.length === 0) {
    return (
      <div style={{ padding: 12, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>redi devtools</div>
        <div style={{ marginBottom: 8 }}>No root injector detected.</div>
        <div>
          This panel auto-detects root injectors (where parent === null). Create at least one root Injector in the
          inspected page, and keep it alive.
        </div>
      </div>
    );
  }

  // For now, show the first root graph.
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        position: 'relative',
        minHeight: 0 // Important for flex children to respect overflow
      }}>
        <RediGraph snapshot={roots[0]} />
      </div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<App />);
}
