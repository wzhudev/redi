import type { BenchCase } from '../harness';
import { Injector, LookUp } from '../redi';

const ROOT_TOKEN = 'bench:hierarchy:root-token';
const SHADOW_TOKEN = 'bench:hierarchy:shadow-token';

interface HierarchyHolder {
  root: Injector | null;
  leaf: Injector | null;
}

function makeParentLookupCase(depth: number): BenchCase {
  const holder: HierarchyHolder = { root: null, leaf: null };

  return {
    group: 'hierarchy',
    name: `parent lookup (depth=${depth})`,
    beforeAll: () => {
      const root = new Injector([[ROOT_TOKEN, { useValue: { value: 42 } }]]);
      let current = root;
      for (let index = 0; index < depth; index += 1) {
        current = current.createChild();
      }

      holder.root = root;
      holder.leaf = current;
      current.get(ROOT_TOKEN);
    },
    afterAll: () => {
      holder.root?.dispose();
      holder.root = null;
      holder.leaf = null;
    },
    fn: () => holder.leaf?.get(ROOT_TOKEN),
  };
}

function makeShadowCase(name: string, lookUp: LookUp): BenchCase {
  const holder: HierarchyHolder = { root: null, leaf: null };

  return {
    group: 'hierarchy',
    name,
    beforeAll: () => {
      const root = new Injector([[SHADOW_TOKEN, { useValue: 'root' }]]);
      const child = root.createChild([[SHADOW_TOKEN, { useValue: 'child' }]]);
      child.get(SHADOW_TOKEN);
      child.get(SHADOW_TOKEN, LookUp.SKIP_SELF);

      holder.root = root;
      holder.leaf = child;
    },
    afterAll: () => {
      holder.root?.dispose();
      holder.root = null;
      holder.leaf = null;
    },
    fn: () => holder.leaf?.get(SHADOW_TOKEN, lookUp),
  };
}

export const cases: BenchCase[] = [
  ...[1, 3, 5, 10].map(makeParentLookupCase),

  makeShadowCase('self shadowed token', LookUp.SELF),

  makeShadowCase('skip-self shadowed token', LookUp.SKIP_SELF),
];
