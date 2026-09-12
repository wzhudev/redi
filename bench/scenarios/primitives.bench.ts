import type { BenchCase } from '../harness';
import type { Ctor, Dependency } from '../redi';
import { Injector } from '../redi';

function makeValueRegistration(size: number): Dependency[] {
  const registration: Dependency[] = [];
  for (let index = 0; index < size; index += 1) {
    registration.push([`bench:primitive:value:${index}`, { useValue: index }]);
  }
  return registration;
}

function makeClassRegistration(size: number): Dependency[] {
  const registration: Dependency[] = [];
  for (let index = 0; index < size; index += 1) {
    registration.push([class Primitive {}] as [Ctor<any>]);
  }
  return registration;
}

const SIZES = [100, 1000, 10000];

export const cases: BenchCase[] = [
  ...SIZES.map((size): BenchCase => {
    const registration = makeValueRegistration(size);
    return {
      group: 'primitives',
      name: `new Injector(value registrations=${size})`,
      fn: () => new Injector(registration),
    };
  }),
  ...SIZES.map((size): BenchCase => {
    const registration = makeClassRegistration(size);
    return {
      group: 'primitives',
      name: `new Injector(class registrations=${size})`,
      fn: () => new Injector(registration),
    };
  }),
];
