'use client';

import type { DependencyIdentifier } from '@wendellhu/redi';
import type { DebuggerPanelProps } from '@wendellhu/redi-devtools';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './DevtoolsDemo.module.css';

interface ApiConfig {
  readonly endpoint: string;
}

interface Logger {
  readonly destination: string;
}

interface DashboardPlugin {
  readonly name: string;
}

interface Cache {
  readonly kind: string;
}

interface DashboardRuntime {
  readonly cacheAvailable: boolean;
  readonly endpoint: string;
  readonly loggerDestination: string;
  readonly pluginCount: number;
}

interface IReportsModule {
  readonly name: string;
}

class AuditService {
  readonly enabled = true;
}

class ConsoleLogger implements Logger {
  readonly destination = 'console';
}

class SearchDashboardPlugin implements DashboardPlugin {
  readonly name = 'search';
}

class ExportDashboardPlugin implements DashboardPlugin {
  readonly name = 'export';
}

interface DemoFixture {
  readonly dispose: () => void;
  readonly loadReports: () => Promise<void>;
  readonly resolveDashboard: () => void;
}

interface DemoIdentifiers {
  readonly ApiConfig: DependencyIdentifier<ApiConfig>;
  readonly Dashboard: DependencyIdentifier<DashboardRuntime>;
  readonly DashboardAlias: DependencyIdentifier<DashboardRuntime>;
  readonly DashboardPlugin: DependencyIdentifier<DashboardPlugin>;
  readonly Logger: DependencyIdentifier<Logger>;
  readonly MissingCache: DependencyIdentifier<Cache>;
  readonly ReportsModule: DependencyIdentifier<IReportsModule>;
}

type PanelComponent = ComponentType<DebuggerPanelProps>;
type ReportsState = 'loading' | 'loaded' | 'pending';

const panelStyle = { border: 0, borderRadius: 0, height: 560 } as const;
const identifiersByRuntime = new WeakMap<object, DemoIdentifiers>();

function getDemoIdentifiers(
  redi: typeof import('@wendellhu/redi'),
): DemoIdentifiers {
  const cached = identifiersByRuntime.get(redi);
  if (cached) return cached;

  const identifiers: DemoIdentifiers = {
    ApiConfig: redi.createIdentifier<ApiConfig>('DocsDemoApiConfig'),
    Dashboard: redi.createIdentifier<DashboardRuntime>('DocsDemoDashboard'),
    DashboardAlias:
      redi.createIdentifier<DashboardRuntime>('DocsDemoDashboardAlias'),
    DashboardPlugin:
      redi.createIdentifier<DashboardPlugin>('IDashboardPlugin'),
    Logger: redi.createIdentifier<Logger>('ILogger'),
    MissingCache: redi.createIdentifier<Cache>('DocsDemoMissingCache'),
    ReportsModule:
      redi.createIdentifier<IReportsModule>('IReportsModule'),
  };
  identifiersByRuntime.set(redi, identifiers);
  return identifiers;
}

function createDemoFixture(
  redi: typeof import('@wendellhu/redi'),
): DemoFixture {
  const {
    ApiConfig,
    Dashboard,
    DashboardAlias,
    DashboardPlugin,
    Logger,
    MissingCache,
    ReportsModule,
  } = getDemoIdentifiers(redi);

  const root = new redi.Injector([
    [ApiConfig, { useValue: { endpoint: 'https://api.example.test' } }],
    [Logger, { useClass: ConsoleLogger }],
    [DashboardPlugin, { useClass: SearchDashboardPlugin }],
    [DashboardPlugin, { useClass: ExportDashboardPlugin }],
    [AuditService, { lazy: true, useClass: AuditService }],
    [
      ReportsModule,
      {
        useAsync: async () => ({ name: 'reports' }),
      },
    ],
  ]);
  redi.setInjectorDiscoveryMetadata(root, {
    label: 'Application root',
    react: { componentName: 'DevtoolsDemo', source: 'docs' },
  });

  const child = root.createChild([
    [ApiConfig, { useValue: { endpoint: 'https://feature.example.test' } }],
    [
      Dashboard,
      {
        deps: [
          [new redi.SkipSelf(), ApiConfig],
          Logger,
          [new redi.Many(), DashboardPlugin],
          [new redi.Optional(), MissingCache],
        ],
        useFactory: (
          config: ApiConfig,
          logger: Logger,
          plugins: DashboardPlugin[],
          cache: Cache | null,
        ): DashboardRuntime => ({
          cacheAvailable: cache !== null,
          endpoint: config.endpoint,
          loggerDestination: logger.destination,
          pluginCount: plugins.length,
        }),
      },
    ],
    [DashboardAlias, { useExisting: Dashboard }],
  ]);
  redi.setInjectorDiscoveryMetadata(child, {
    label: 'Dashboard scope',
    react: { componentName: 'DashboardFeature', source: 'docs' },
  });

  return {
    dispose: () => root.dispose(),
    loadReports: async () => {
      await root.getAsync(ReportsModule);
    },
    resolveDashboard: () => {
      child.get(Dashboard);
    },
  };
}

export function DevtoolsDemo() {
  const fixtureRef = useRef<DemoFixture | null>(null);
  const [Panel, setPanel] = useState<PanelComponent | null>(null);
  const [dashboardResolved, setDashboardResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportsState, setReportsState] =
    useState<ReportsState>('pending');

  useEffect(() => {
    let active = true;

    void Promise.all([
      import('@wendellhu/redi'),
      import('@wendellhu/redi-devtools'),
    ])
      .then(([redi, devtools]) => {
        if (!active) return;

        fixtureRef.current = createDemoFixture(redi);
        setPanel(() => devtools.DebuggerPanel);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : 'Could not load the demo.',
        );
      });

    return () => {
      active = false;
      const fixture = fixtureRef.current;
      fixtureRef.current = null;
      fixture?.dispose();
    };
  }, []);

  const resolveDashboard = () => {
    const fixture = fixtureRef.current;
    if (!fixture || dashboardResolved) return;

    try {
      fixture.resolveDashboard();
      setDashboardResolved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not resolve Dashboard.',
      );
    }
  };

  const loadReports = async () => {
    const fixture = fixtureRef.current;
    if (!fixture || reportsState !== 'pending') return;

    setReportsState('loading');
    try {
      await fixture.loadReports();
      if (fixtureRef.current !== fixture) return;
      setReportsState('loaded');
    } catch (reason) {
      if (fixtureRef.current !== fixture) return;
      setReportsState('pending');
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load ReportsModule.',
      );
    }
  };

  const ready = Panel !== null;
  const status = `Dashboard: ${dashboardResolved ? 'created' : 'not-created'} · ILogger → ConsoleLogger · @Many(IDashboardPlugin) × 2 · Reports: ${reportsState === 'loaded' ? 'created' : reportsState} · AuditService: not-created`;

  return (
    <section className={styles.demo} aria-label="Interactive redi DevTools demo">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Live demo</span>
          <h3 className={styles.title}>Dependency Graph</h3>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.button}
            disabled={!ready || dashboardResolved}
            onClick={resolveDashboard}
            type="button"
          >
            {dashboardResolved ? 'Dashboard resolved' : 'Resolve dashboard'}
          </button>
          <button
            className={styles.button}
            disabled={!ready || reportsState !== 'pending'}
            onClick={() => void loadReports()}
            type="button"
          >
            {reportsState === 'loading'
              ? 'Loading reports…'
              : reportsState === 'loaded'
                ? 'Reports loaded'
                : 'Load async provider'}
          </button>
        </div>
      </header>

      <p className={styles.status} aria-live="polite">
        {status}
      </p>

      {error
        ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )
        : null}

      {Panel
        ? (
            <Panel pollInterval={500} style={panelStyle} />
          )
        : error
          ? null
          : (
            <div className={styles.loading} role="status">
              Loading the interactive debugger…
            </div>
            )}
    </section>
  );
}
