import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DebuggerPanel } from './ui/DebuggerPanel';

/* eslint-disable ts/no-use-before-define -- static style objects stay below component logic */

export interface SetupDebuggerOptions {
  /** Element receiving the overlay host. Defaults to `document.body`. */
  readonly container?: HTMLElement;
  /** Passed to the shared Debugger Panel. `false` disables polling. */
  readonly pollInterval?: number | false;
  /** Overlay stacking order. */
  readonly zIndex?: number;
}

export interface DebuggerHandle {
  /** Unmount and remove the overlay. Safe to call more than once. */
  readonly dispose: () => void;
}

interface OverlayProps {
  readonly onClose: () => void;
  readonly pollInterval?: number | false;
  readonly zIndex: number;
}

function Overlay({ onClose, pollInterval, zIndex }: OverlayProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      data-redi-devtools-overlay-window=""
      aria-label="redi Dependency Graph debugger"
      style={{ ...overlayStyle, zIndex, height: collapsed ? 'auto' : 520 }}
    >
      <header style={overlayHeaderStyle}>
        <strong>redi DevTools — Dependency Graph</strong>
        <button
          type="button"
          aria-label={collapsed ? 'Expand debugger' : 'Collapse debugger'}
          onClick={() => setCollapsed((current) => !current)}
          style={{ ...overlayButtonStyle, marginLeft: 'auto' }}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
        <button
          type="button"
          aria-label="Close debugger"
          onClick={onClose}
          style={overlayButtonStyle}
        >
          Close
        </button>
      </header>
      {collapsed
? null
: (
        <div style={overlayPanelStyle}>
          <DebuggerPanel
            pollInterval={pollInterval}
            style={{ border: 0, borderRadius: 0 }}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Explicitly mount the debugger Overlay. Merely importing this module never
 * creates DOM, a React root, listeners or timers.
 */
export function setupDebugger(
  options: SetupDebuggerOptions = {},
): DebuggerHandle {
  if (typeof document === 'undefined') {
    throw new TypeError('setupDebugger() requires a DOM document.');
  }

  const container = options.container ?? document.body;
  const host = document.createElement('div');
  host.setAttribute('data-redi-devtools-overlay', '');
  container.appendChild(host);

  const root = createRoot(host);
  let disposed = false;
  const handle: DebuggerHandle = {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.unmount();
      host.remove();
    },
  };

  root.render(
    <Overlay
      onClose={() => queueMicrotask(handle.dispose)}
      pollInterval={options.pollInterval}
      zIndex={options.zIndex ?? 2147483000}
    />,
  );

  return handle;
}

const overlayStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 10,
  bottom: 16,
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.28)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 32px)',
  maxWidth: 'calc(100vw - 32px)',
  overflow: 'hidden',
  position: 'fixed',
  right: 16,
  width: 820,
};
const overlayHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  background: '#0f172a',
  color: '#e2e8f0',
  display: 'flex',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  gap: 8,
  padding: '8px 12px',
};
const overlayButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#cbd5e1',
  cursor: 'pointer',
  font: 'inherit',
  padding: '2px 4px',
};
const overlayPanelStyle: React.CSSProperties = { flex: 1, minHeight: 0 };
