import type { DependencyPair } from '@wendellhu/redi';
import type { BB } from './async.base';

import { Inject } from '@wendellhu/redi';
import { AA, bbI } from './async.base';

export class BBImpl implements BB {
  static counter = 0;

  constructor(@Inject(AA) private readonly aa: AA) {
    BBImpl.counter += 1;
  }

  get key(): string {
    return `${this.aa.key}bb`;
  }

  public getConstructedTime(): number {
    return BBImpl.counter;
  }
}

export const BBFactory: DependencyPair<BB> = [
  bbI,
  {
    useFactory: (aa: AA) => {
      return {
        key: `${aa.key}bb2`,
      };
    },
    deps: [AA],
  },
];

export const BBLoader: DependencyPair<any> = [
  'dead',
  {
    useAsync: () => import('./async.dead').then((module) => module.A),
  },
];

export const BBValue: BB = {
  key: 'bb3',
};
