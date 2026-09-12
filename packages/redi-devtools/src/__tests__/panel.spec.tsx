import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  createIdentifier,
  Injector,
  setInjectorDiscoveryMetadata,
  SkipSelf,
} from '@wendellhu/redi';
import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { DebuggerPanel } from '../ui/DebuggerPanel';

afterEach(() => {
  cleanup();
});

describe('DebuggerPanel', () => {
  test('renders and navigates one compound root tree at a time', async () => {
    const target = createIdentifier<number>('panel-target');
    const consumer = createIdentifier<number>('panel-consumer');
    const firstRoot = new Injector([[target, { useValue: 1 }]]);
    const child = firstRoot.createChild([
      [
        consumer,
        {
          deps: [[new SkipSelf(), target]],
          useFactory: (value: number) => value,
        },
      ],
    ]);
    const secondRoot = new Injector();
    setInjectorDiscoveryMetadata(firstRoot, { label: 'Panel root' });
    setInjectorDiscoveryMetadata(child, {
      label: 'Panel child',
      react: {
        componentName: 'PanelProvider',
        source: 'react-context',
      },
    });
    setInjectorDiscoveryMetadata(secondRoot, { label: 'Other root' });

    try {
      const { container } = render(
        <DebuggerPanel
          pollInterval={false}
          style={{ height: 640, width: 900 }}
        />,
      );
      const rootSwitch = screen.getByLabelText(
        'Root Injector',
      ) as HTMLSelectElement;
      expect(rootSwitch.textContent).toContain('Panel root');
      expect(rootSwitch.textContent).toContain('Other root');
      expect(rootSwitch.textContent).not.toContain('Panel child');
      const panelRootOption = [...rootSwitch.options].find(
        (option) => option.textContent === 'Panel root',
      )!;
      fireEvent.change(rootSwitch, {
        target: { value: panelRootOption.value },
      });

      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-redi-devtools-cluster]'),
        ).toHaveLength(2);
      });
      expect(
        container.querySelectorAll('[data-redi-devtools-group]'),
      ).toHaveLength(2);
      expect(
        container.querySelectorAll('[data-redi-devtools-registration]'),
      ).toHaveLength(2);
      const registrationCards = [
        ...container.querySelectorAll('[data-redi-devtools-registration]'),
      ];
      expect(
        registrationCards.some((card) =>
          card.textContent?.includes('useFactoryfactory'),
        ),
      ).toBe(true);
      expect(
        registrationCards.some((card) =>
          card.textContent?.includes('panel-consumer'),
        ),
      ).toBe(false);
      expect(
        container
          .querySelector('[data-redi-devtools-registration-source]')
          ?.classList
.contains('react-flow__handle-top'),
      ).toBe(true);
      expect(
        container
          .querySelector('[data-redi-devtools-registration-target]')
          ?.classList
.contains('react-flow__handle-bottom'),
      ).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /Panel child.*#/i }));
      expect(
        container.querySelector('[data-redi-devtools-details]')?.textContent,
      ).toContain('PanelProvider');

      fireEvent.change(screen.getByLabelText('Search active Injector tree'), {
        target: { value: 'panel-consumer' },
      });
      fireEvent.click(screen.getByRole('option', { name: /panel-consumer/i }));
      const details = container.querySelector('[data-redi-devtools-details]')!;
      expect(details.textContent).toContain('Outgoing dependencies');
      expect(details.textContent).toContain('@SkipSelf panel-target');
      expect(details.textContent).toContain('Panel root');

      const otherRootOption = [...rootSwitch.options].find(
        (option) => option.textContent === 'Other root',
      )!;
      fireEvent.change(rootSwitch, {
        target: { value: otherRootOption.value },
      });
      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-redi-devtools-cluster]'),
        ).toHaveLength(1);
      });
      expect(container.textContent).toContain('Other root');
      expect(container.textContent).not.toContain('Panel child');
    } finally {
      firstRoot.dispose();
      secondRoot.dispose();
    }
  });

  test('search reveals entities and collapse controls hide independent layers', async () => {
    const token = createIdentifier<number>('search-target');
    const root = new Injector([[token, { useValue: 1 }]]);
    const child = root.createChild();
    setInjectorDiscoveryMetadata(root, { label: 'Search root' });
    setInjectorDiscoveryMetadata(child, { label: 'Search child' });

    try {
      const { container } = render(
        <DebuggerPanel
          pollInterval={false}
          style={{ height: 640, width: 900 }}
        />,
      );
      const rootSwitch = screen.getByLabelText(
        'Root Injector',
      ) as HTMLSelectElement;
      const searchRootOption = [...rootSwitch.options].find(
        (option) => option.textContent === 'Search root',
      )!;
      fireEvent.change(rootSwitch, {
        target: { value: searchRootOption.value },
      });
      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-redi-devtools-cluster]'),
        ).toHaveLength(2);
      });

      fireEvent.change(screen.getByLabelText('Search active Injector tree'), {
        target: { value: 'search-target' },
      });
      fireEvent.click(screen.getByRole('option', { name: /search-target/i }));
      expect(
        container.querySelector('[data-redi-devtools-details]')?.textContent,
      ).toContain('search-target');

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Hide registrations in Search root',
        }),
      );
      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-redi-devtools-registration]'),
        ).toHaveLength(0);
        expect(container.textContent).toContain('1 registration hidden');
      });

      fireEvent.click(
        screen.getByRole('button', { name: 'Hide subtree of Search root' }),
      );
      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-redi-devtools-cluster]'),
        ).toHaveLength(1);
      });
    } finally {
      root.dispose();
    }
  });
});
