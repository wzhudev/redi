/* eslint-disable no-console */
import { createIdentifier, Injector, LookUp, Quantity } from '../src';

// Experiment 1: @Self() + @Optional() when missing — does runtime throw or return null?
const IA = createIdentifier<{ a: number }>('exp-IA');
const parent = new Injector([[IA, { useValue: { a: 1 } }]]);
const child = parent.createChild();

try {
  const r = child.get(IA, Quantity.OPTIONAL, LookUp.SELF);
  console.log('SELF+OPTIONAL missing →', r);
} catch (e) {
  console.log('SELF+OPTIONAL missing → THROW:', (e as Error).message.slice(0, 80));
}

try {
  const r = child.get(IA, Quantity.MANY, LookUp.SELF);
  console.log('SELF+MANY missing →', r);
} catch (e) {
  console.log('SELF+MANY missing → THROW:', (e as Error).message.slice(0, 80));
}

// Experiment 2: withNew skips resolved-only instance injector?
const IB = createIdentifier<{ b: number }>('exp-IB');
const gp = new Injector([[IB, { useFactory: () => ({ b: 42 }) }]]);
const mid = gp.createChild();
mid.add([IB, { b: 99 } as any]); // direct instance on mid
const leaf = mid.createChild();

console.log('normal get lands mid instance →', leaf.get(IB));
// simulate @WithNew via private _get
const viaNew = (leaf as any)._get(IB, Quantity.REQUIRED, undefined, true);
console.log('withNew get →', viaNew);

// Experiment 3: withNew + SELF ignored by createDependency?
const IC = createIdentifier<{ c: number }>('exp-IC');
const p3 = new Injector([[IC, { useFactory: () => ({ c: 7 }) }]]);
const c3 = p3.createChild();
try {
  const r = (c3 as any)._get(IC, Quantity.REQUIRED, LookUp.SELF, true);
  console.log('withNew+SELF missing on self →', r);
} catch (e) {
  console.log('withNew+SELF missing on self → THROW:', (e as Error).message.slice(0, 80));
}

// Experiment 4: Injector token + SKIP_SELF
const p4 = new Injector();
const c4 = p4.createChild();
console.log('Injector token SKIP_SELF → parent?', c4.get(Injector, LookUp.SKIP_SELF) === p4);
try {
  const r = p4.get(Injector, LookUp.SKIP_SELF);
  console.log('Injector token SKIP_SELF at root →', r);
} catch (e) {
  console.log('Injector token SKIP_SELF at root → THROW:', (e as Error).message.slice(0, 80));
}

// Experiment 5: OPTIONAL landing with 2 registrations → throws quantity error?
const ID = createIdentifier<{ d: number }>('exp-ID');
const p5 = new Injector([
  [ID, { useValue: { d: 1 } }],
  [ID, { useValue: { d: 2 } }],
]);
try {
  const r = p5.get(ID, Quantity.OPTIONAL);
  console.log('OPTIONAL with 2 regs →', r);
} catch (e) {
  console.log('OPTIONAL with 2 regs → THROW:', (e as Error).message.slice(0, 80));
}
