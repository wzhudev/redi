import type { BenchCase } from '../harness';
import { cases as hierarchyCases } from './hierarchy.bench';
import { cases as instantiateCases } from './instantiate.bench';
import { cases as primitivesCases } from './primitives.bench';
import { cases as resolveCases } from './resolve.bench';
import { cases as variantsCases } from './variants.bench';

export const allCases: BenchCase[] = [
  ...primitivesCases,
  ...resolveCases,
  ...instantiateCases,
  ...hierarchyCases,
  ...variantsCases,
];
