/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable ts/no-redeclare */

import type { AsyncHook, IDisposable } from '@wendellhu/redi';
import type { BB } from '../__testing__/async/async.base';
import {
  createIdentifier,
  forwardRef,
  Inject,
  Injector,
  InjectSelf,
  LookUp,
  Many,
  Optional,
  Quantity,
  Self,
  setDependencies,
  SkipSelf,
  WithNew,
} from '@wendellhu/redi';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AA, bbI } from '../__testing__/async/async.base';
import { expectToThrow } from '../__testing__/expectToThrow';
import { TEST_ONLY_clearKnownIdentifiers } from '../decorators';

function cleanupTest() {
  TEST_ONLY_clearKnownIdentifiers();
}

describe('core', () => {
  afterEach(() => cleanupTest());

  describe('basics', () => {
    it('should resolve instance and then cache it', () => {
      let createCount = 0;

      class A {
        constructor() {
          createCount += 1;
        }
      }

      const j = new Injector([[A]]);

      j.get(A);
      expect(createCount).toBe(1);

      j.get(A);
      expect(createCount).toBe(1);
    });

    it('should support adding dependencies', () => {
      const j = new Injector();

      class A {
        key = 'a';
      }

      class B {
        constructor(@Inject(A) public a: A) {}
      }

      interface C {
        key: string;
      }

      const cI = createIdentifier<C>('cI');
      const cII = createIdentifier<C>('cII');

      const a = new A();

      j.add([A, a]);
      j.add([B]);
      j.add([
        cI,
        {
          useFactory: (a: A) => ({
            key: a.key,
          }),
          deps: [A],
        },
      ]);
      j.add([
        cII,
        {
          useFactory: (a: A) => ({
            key: a.key,
          }),
          deps: [A],
        },
      ]);

      const b = j.get(B);
      expect(b.a).toBe(a);

      const c = j.get(cI);
      expect(c.key).toBe('a');

      const cii = j.get(cII);
      expect(cii.key).toBe('a');
    });

    it('should throw error when adding a dependency after it get resolved', () => {
      const j = new Injector();

      interface IA {
        key: string;
      }

      const IA = createIdentifier<IA>('IA');

      class A implements IA {
        key = 'a';
      }

      class B {
        constructor(@Inject(IA) public a: IA) {}
      }

      j.add([IA, { useClass: A }]);
      j.add([B]);

      j.get(B);

      class AA implements IA {
        key = 'aa';
      }

      expectToThrow(() => {
        j.add([IA, { useClass: AA }]);
      });
    });

    it('should support replacing dependency', () => {
      const j = new Injector();

      interface IA {
        key: string;
      }

      const IA = createIdentifier<IA>('IA');

      class A implements IA {
        key = 'a';
      }

      class AA implements IA {
        key = 'aa';
      }

      class B {
        constructor(@Inject(IA) public a: IA) {}
      }

      j.add([IA, { useClass: A }]);
      j.add([B]);
      j.replace([IA, { useClass: AA }]);

      expect(j.get(B).a.key.length).toEqual(2);
    });

    it('should throw an error when replacing an identifier after it has instantiated', () => {
      const j = new Injector();

      interface IA {
        key: string;
      }

      const IA = createIdentifier<IA>('IA');

      class A implements IA {
        key = 'a';
      }

      class AA implements IA {
        key = 'aa';
      }

      class B {
        constructor(@Inject(IA) public a: IA) {}
      }

      j.add([IA, { useClass: A }]);
      j.add([B]);
      expect(j.get(B).a.key.length).toEqual(1);

      expectToThrow(() => {
        j.replace([IA, { useClass: AA }]);
      }, '[redi]: Cannot add dependency "IA" after it is already resolved.');
    });

    it('should "createInstance" work', () => {
      class A {
        key = 'a';
      }

      class B {
        constructor(@Inject(A) public a: A) {}
      }

      const j = new Injector([[A]]);
      const b = j.createInstance(B);

      expect(b.a.key).toBe('a');
    });

    it('should "createInstance" support custom args', () => {
      class A {
        key = 'a';
      }

      class B {
        constructor(
          private readonly _otherKey: string,
          @Inject(A) public readonly a: A,
        ) {}

        get key() {
          return `${this._otherKey}a`;
        }
      }

      const j = new Injector([[A]]);
      const b = j.createInstance(B, 'another ');
      expect(b.key).toBe('another a');
    });

    it('should "createInstance" truncate extra custom args', () => {
      class A {
        key = 'a';
      }

      class B {
        constructor(
          private readonly _otherKey: string,
          @Inject(A) public readonly a: A,
        ) {}

        get key() {
          return `${this._otherKey}a`;
        }
      }

      const j = new Injector([[A]]);
      // @ts-expect-error for testing purpose
      const b = j.createInstance(B, 'another ', 'extra', 'args', 'ignored');
      expect(b.key).toBe('another a');
    });

    it('should "createInstance" fill unprovided custom args with "undefined"', () => {
      class A {
        key = 'a';
      }

      class B {
        constructor(
          private readonly _otherKey: string,
          private readonly _secondKey: string,
          @Inject(A) public readonly a: A,
        ) {}

        get key() {
          return `${this._otherKey + this._secondKey} ${this.a.key}`;
        }
      }

      const spy = vi.spyOn(console, 'warn');
      spy.mockImplementation(() => {});

      const j = new Injector([[A]]);
      const b = j.createInstance(B, 'another ');

      expect(b.key).toBe('another undefined a');
      expect(spy).toHaveReturnedTimes(1);

      spy.mockRestore();
    });

    it('should detect circular dependency', () => {
      const aI = createIdentifier('aI');
      const bI = createIdentifier('bI');

      class A {
        constructor(@Inject(bI) private readonly _b: any) {}
      }

      class B {
        constructor(@Inject(aI) private readonly _a: any) {}
      }

      const j = new Injector([
        [aI, { useClass: A }],
        [bI, { useClass: B }],
      ]);

      expectToThrow(() => j.get(aI), `[redi]: Detecting cyclic dependency: "aI -> bI -> aI".`);
    });

    it('should "invoke" work', () => {
      class A {
        a = 'a';
      }

      const j = new Injector([[A]]);

      const a = j.invoke((accessor) => {
        // Can use `has` API to check if a dependency is registered.
        expect(accessor.has(A)).toBeTruthy();

        return accessor.get(A).a;
      });

      expect(a).toBe('a');
    });

    it('should support checking if a dependency could be resolved by an injector', () => {
      class A {}

      class B {}

      const j = new Injector([[A]]);

      expect(j.has(A)).toBeTruthy();
      expect(j.has(B)).toBeFalsy();
    });

    it('should support deleting unresolved dependencies', () => {
      class A {}

      const injector = new Injector([[A]]);
      injector.delete(A);

      expectToThrow(() => {
        injector.get(A);
      }, '[redi]: Expect 1 dependency item(s) for id "A" but get 0. Did you forget to register it?');
    });

    it('should throw an error trying to delete a resolved dependency', () => {
      class A {}

      const injector = new Injector([[A]]);

      injector.get(A);

      expectToThrow(() => {
        injector.delete(A);
      }, '[redi]: Cannot delete dependency "A" when it is already resolved.');
    });
  });

  describe('different types of dependency items', () => {
    describe('class item', () => {
      it('should dispose idle callback when dependency immediately resolved', async () => {
        interface A {
          key: string;
        }

        let count = 0;

        const aI = createIdentifier<A>('aI');

        class A1 implements A {
          key = 'a';

          constructor() {
            count += 1;
          }
        }

        class B {
          key: string;

          constructor(@aI private readonly _a: A) {
            this.key = `${this._a.key}b`;
          }
        }

        const j = new Injector([[B], [aI, { useClass: A1, lazy: true }]]);

        j.get(B);
        expect(count).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(count).toBe(1);
      });

      it('should initialize when lazy class instance is actually accessed', () => {
        interface A {
          key: string;

          getAnotherKey: () => string;
        }

        let flag = false;

        const aI = createIdentifier<A>('aI');

        class A1 implements A {
          key = 'a';

          constructor() {
            flag = true;
          }

          getAnotherKey(): string {
            return `another ${this.key}`;
          }
        }

        class B {
          constructor(@Inject(aI) private _a: A) {}

          get key(): string {
            return `${this._a.key}b`;
          }

          getAnotherKey(): string {
            return `${this._a.getAnotherKey()}b`;
          }

          setKey(): void {
            this._a.key = 'changed ';
          }
        }

        const j = new Injector([[B], [aI, { useClass: A1, lazy: true }]]);

        const b = j.get(B);
        expect(flag).toBeFalsy();

        expect(b.key).toBe('ab');
        expect(flag).toBeTruthy();

        expect(b.getAnotherKey()).toBe('another ab');

        b.setKey();

        expect(b.getAnotherKey()).toBe('another changed b');
      });

      it('should support "setDependencies"', () => {
        class A {
          key = 'a';
        }

        class B {
          constructor(public readonly a: A) {}
        }

        setDependencies(B, [[A]]);

        const j = new Injector([[A], [B]]);

        const b = j.get(B);

        expect(b.a.key).toBe('a');
      });

      it('should warn use when a dependency is missing', () => {
        class A {
          constructor(private _b: typeof B) {}

          get key(): string {
            return typeof this._b === 'undefined' ? 'undefined' : `a${this._b.key}`;
          }
        }

        // mock that B is not assigned to the class constructor
        let B: any;

        expect(() => {
          setDependencies(A, [B]);
        }).toThrow('[redi]: It seems that you register "undefined" as dependency on the 0th parameter of "A".');

        B = class {
          key = 'b';
        };
      });

      it('[class item] should throw error when a dependency cannot be resolved', () => {
        class A {}

        class B {
          constructor(
            _param: string,
            @Inject(A) private readonly _a: A,
          ) {}
        }

        const j = new Injector([[B]]);
        expect(() => {
          j.get(B);
        }).toThrow('[redi]: Cannot find "A" registered by any injector. It is the 1th param of "B".');
      });
    });

    describe('instance item', () => {
      it('should just work', () => {
        const a = {
          key: 'a',
        };

        interface A {
          key: string;
        }

        const aI = createIdentifier<A>('aI');

        const j = new Injector([[aI, { useValue: a }]]);

        expect(j.get(aI).key).toBe('a');
      });
    });

    describe('factory item', () => {
      it('should just work with zero dep', () => {
        interface A {
          key: string;
        }

        const aI = createIdentifier<A>('aI');

        const j = new Injector([
          [
            aI,
            {
              useFactory: () => ({
                key: 'a',
              }),
            },
          ],
        ]);

        expect(j.get(aI).key).toBe('a');
      });

      it('should throw error when a dependency cannot be resolved', () => {
        class A {}

        interface IB {
          name: string;
        }

        const b = createIdentifier<IB>('b');

        const j = new Injector(
          [[b, { useFactory: (_a: A) => ({ name: b }), deps: [A] }]],
          undefined,
          { name: 'test-injector' },
        );

        expectToThrow(() => {
          j.get(b);
        }, '[redi]: Cannot find "A" registered by any injector. It is the 0th param of "b".');
        expect(j.name).toBe('test-injector');
      });
    });

    describe('existing item', () => {
      it('should reuse existing instance', () => {
        let initCount = 0;

        class A {
          constructor() {
            initCount += 1;
          }
        }

        const b = createIdentifier<A>('b');

        const j = new Injector([[A], [b, { useExisting: A }]]);

        expect(j.get(b)).toBe(j.get(A));
        expect(initCount).toBe(1);
      });
    });

    describe('async item', () => {
      it('should support async loaded ctor', () =>
        new Promise<void>((done) => {
          const j = new Injector([
            [AA],
            [
              bbI,
              {
                useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBImpl),
              },
            ],
          ]);

          j.getAsync(bbI).then((bb) => {
            expect(bb.key).toBe('aabb');
            expect(bb.getConstructedTime?.()).toBe(1);
          });

          // should check if instantiated in whenReady
          j.getAsync(bbI).then((bb) => {
            expect(bb.key).toBe('aabb');
            expect(bb.getConstructedTime?.()).toBe(1);
          });

          new Promise((resolve) => setTimeout(resolve, 3000)).then(() => {
            // should use cached value this time
            j.getAsync(bbI).then((bb) => {
              expect(bb.key).toBe('aabb');
              expect(bb.getConstructedTime?.()).toBe(1);
              done();
            });
          });
        }));

      it('should support async loaded factory', () =>
        new Promise<void>((done) => {
          const j = new Injector([
            [AA],
            [
              bbI,
              {
                useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBFactory),
              },
            ],
          ]);

          j.getAsync(bbI).then((bb) => {
            expect(bb.key).toBe('aabb2');
            done();
          });
        }));

      it('should support async loaded value', () =>
        new Promise<void>((done) => {
          const j = new Injector([
            [AA],
            [
              bbI,
              {
                useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBValue),
              },
            ],
          ]);

          j.getAsync(bbI).then((bb) => {
            expect(bb.key).toBe('bb3');
            done();
          });
        }));

      it('should "getAsync" support sync dependency items', () =>
        new Promise<void>((done) => {
          interface A {
            key: string;
          }

          const iA = createIdentifier<A>('iA');

          const j = new Injector([
            [
              iA,
              {
                useValue: {
                  key: 'a',
                },
              },
            ],
          ]);

          j.getAsync(iA).then((a) => {
            expect(a.key).toBe('a');
            done();
          });
        }));

      it('should throw error when async loader returns a async loader', () =>
        new Promise<void>((done) => {
          const j = new Injector([
            [AA],
            [
              bbI,
              {
                useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBLoader),
              },
            ],
          ]);

          j.getAsync(bbI)
            .then((bb) => {
              expect(bb.key).toBe('aabb2');
            })
            .catch(() => {
              // the test would end up here
              done();
            });
        }));

      it('should throw error when get an async item via "get"', () => {
        const j = new Injector([
          [AA],
          [
            bbI,
            {
              useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBFactory),
            },
          ],
        ]);

        expectToThrow(() => {
          j.get(bbI);
        }, '[redi]: Cannot get async item "bb" from sync api.');

        const j2 = new Injector([
          [
            bbI,
            {
              useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBFactory),
            },
          ],
          [
            bbI,
            {
              useValue: {
                key: 'sync-bb',
              },
            },
          ],
        ]);

        expectToThrow(() => {
          j2.get(bbI, Quantity.MANY);
        }, '[redi]: Cannot get async item "bb" from sync api.');
      });

      it('should "AsyncHook" work', () =>
        new Promise<void>((done) => {
          class A {
            constructor(@Inject(bbI) private _bbILoader: AsyncHook<BB>) {}

            public readKey(): Promise<string> {
              return this._bbILoader.whenReady().then((bb) => bb.key);
            }
          }

          const j = new Injector([
            [A],
            [AA],
            [
              bbI,
              {
                useAsync: () => import('../__testing__/async/async.item').then((module) => module.BBFactory),
              },
            ],
          ]);

          j.get(A)
            .readKey()
            .then((key) => {
              expect(key).toBe('aabb2');
              done();
            })
            .catch(() => {
              expect(false).toBeTruthy(); // intent to make this test fail
              done();
            });
        }));
    });

    describe('injector', () => {
      it('should support inject itself', () => {
        const a = {
          key: 'a',
        };

        interface A {
          key: string;
        }

        const aI = createIdentifier<A>('aI');

        const j = new Injector([[aI, { useValue: a }]]);

        // totally verbose for real use case, but to show this works
        expect(j.get(Injector)).toBe(j);
        expect(j.get(Injector).get(aI).key).toBe('a');
      });

      it('should support InjectSelf decorator to inject the current injector', () => {
        class A {
          constructor(@InjectSelf() public readonly injector: Injector) {}
        }

        const parentInjector = new Injector();
        const childInjector = parentInjector.createChild([[A]]);

        const a = childInjector.get(A);

        // InjectSelf should inject the current (child) injector, not the parent
        expect(a.injector).toBe(childInjector);
        expect(a.injector).not.toBe(parentInjector);
      });
    });
  });

  describe('quantities', () => {
    it('should throw error when Required is used with no parameter', () => {
      expectToThrow(() => {
        class A {
          // @ts-expect-error for testing purpose
          constructor(@Inject() private readonly _a: any) {}
        }
      }, '[redi]: It seems that you forgot to provide a parameter to @Required() on the 0th parameter of "A"');
    });

    it('should support "Many"', () => {
      interface A {
        key: string;
      }

      class A1 implements A {
        key = 'a1';
      }

      class A2 implements A {
        key = 'a2';
      }

      const aI = createIdentifier<A>('aI');

      class B {
        constructor(@Many(aI) private _aS: A[]) {}

        get key(): string {
          return `${this._aS.map((a) => a.key).join('')}b`;
        }
      }

      const cI = createIdentifier<A>('cI');

      const j = new Injector([
        [aI, { useClass: A1 }],
        [aI, { useClass: A2 }],
        [B],
        [
          cI,
          {
            useFactory: (aS: A[]) => ({
              key: `${aS.map((a) => a.key).join('')}c`,
            }),
            deps: [[new Many(), aI]],
          },
        ],
      ]);

      expect(j.get(B).key).toBe('a1a2b');
      expect(j.get(cI).key).toBe('a1a2c');
    });

    it('should support "Optional"', () => {
      interface A {
        key: string;
      }

      const aI = createIdentifier<A>('aI');

      class B {
        constructor(@Optional() @aI private _a?: A) {}

        get key(): string {
          return this._a?.key || 'no a' + 'b';
        }
      }

      const cI = createIdentifier<A>('cI');

      const j = new Injector([
        [B],
        [
          cI,
          {
            useFactory: (aS?: A) => ({
              key: aS?.key || 'no a' + 'c',
            }),
            deps: [[new Optional(), aI]],
          },
        ],
      ]);

      expect(j.get(B).key).toBe('no ab');
      expect(j.get(cI).key).toBe('no ac');
    });

    it('should throw error when using decorator on a non-injectable parameter', () => {
      class A {}

      expectToThrow(() => {
        class B {
          constructor(@Optional() _a: A) {}
        }
      }, `[redi]: Could not find dependency registered on the 0 (indexed) parameter of the constructor of "B".`);
    });

    it('should throw error when a required / optional dependency is provided with many values', () => {
      interface A {
        key: string;
      }

      const aI = createIdentifier<A>('aI');

      class B {
        constructor(@aI private _a: A) {}

        get key(): string {
          return this._a?.key || 'no a' + 'b';
        }
      }

      class C {
        constructor(@Optional(aI) private _a: A) {}

        get key(): string {
          return this._a?.key || 'no a' + 'b';
        }
      }

      const j = new Injector([[B], [C], [aI, { useValue: { key: 'a1' } }], [aI, { useValue: { key: 'a2' } }]]);

      expectToThrow(() => j.get(B), `[redi]: Expect 1 dependency item(s) for id "aI" but get 2.`);

      expectToThrow(() => j.get(C), `[redi]: Expect 0 or 1 dependency item(s) for id "aI" but get 2.`);
    });
  });

  describe('hierarchy injection system', () => {
    it('should get dependencies upwards', () => {
      class A {
        key = 'a';
      }

      const cI = createIdentifier<C>('cI');

      interface C {
        key: string;
      }

      class B {
        constructor(
          @Inject(A) private _a: A,
          @Inject(cI) private _c: C,
        ) {}

        get key() {
          return `${this._a.key}b${this._c.key}`;
        }
      }

      class C1 implements C {
        key = 'c1';
      }

      class C2 implements C {
        key = 'c2';
      }

      const injector = new Injector([[A], [B], [cI, { useClass: C1 }]]);
      const child = injector.createChild([[cI, { useClass: C2 }]]);

      const b = child.get(B);
      expect(b.key).toBe('abc1');
    });

    it('should work with "SkipSelf"', () => {
      class A {
        key = 'a';
      }

      interface B {
        key: string;
      }

      const bI = createIdentifier<B>('bI');
      const cI = createIdentifier<C>('cI');

      interface C {
        key: string;
      }

      class C1 implements C {
        key = 'c1';
      }

      class C2 implements C {
        key = 'c2';
      }

      class D {
        constructor(@SkipSelf() @cI private readonly _c: C) {}

        get key(): string {
          return `${this._c.key}d`;
        }
      }

      const injector = new Injector([[A], [cI, { useClass: C1 }]]);
      const child = injector.createChild([
        [cI, { useClass: C2 }],
        [
          bI,
          {
            useFactory: (a: A, c: C) => ({
              key: `${a.key}b${c.key}`,
            }),
            deps: [A, [new SkipSelf(), cI]],
          },
        ],
        [D],
      ]);

      const b = child.get(bI);
      expect(b.key).toBe('abc1');

      const d = child.get(D);
      expect(d.key).toBe('c1d');
    });

    it('should throw error if could not resolve with "Self"', () => {
      class A {
        key = 'a';
      }

      interface B {
        key: string;
      }

      const bI = createIdentifier<B>('bI');
      const cI = createIdentifier<C>('cI');

      interface C {
        key: string;
      }

      class C1 implements C {
        key = 'c1';
      }

      const injector = new Injector([[A], [cI, { useClass: C1 }]]);
      const child = injector.createChild([
        [
          bI,
          {
            useFactory: (a: A, c: C) => ({
              key: `${a.key}b${c.key}`,
            }),
            deps: [A, [new Self(), cI]],
          },
        ],
      ]);

      expectToThrow(
        () => child.get(bI),
        '[redi]: Cannot find "cI" registered by any injector. It is the 1th param of "bI".',
      );
    });

    it('should throw error when no ancestor injector could provide dependency', () => {
      class A {}

      const j = new Injector();

      expectToThrow(
        () => j.get(A),
        `[redi]: Expect 1 dependency item(s) for id "A" but get 0. Did you forget to register it?`,
      );
    });

    it('should not throw error when no ancestor injector could provide dependency with "Optional" or "Many', () => {
      class A {}

      const j = new Injector();
      expect(j.get(A, Quantity.OPTIONAL, LookUp.SKIP_SELF)).toBeNull();
      expect(j.get(A, Quantity.MANY, LookUp.SKIP_SELF)).toEqual([]);
    });

    it('should throw error when no ancestor injector could create dependency', () => {
      class A {}

      class B {
        constructor(@WithNew() @Inject(A) private readonly _a: A) {}
      }

      const j = new Injector([[B]]);

      expectToThrow(() => j.get(B), `[redi]: Cannot find "A" registered by any injector. It is the 0th param of "B".`);
    });

    it('should not throw error when no ancestor injector could create dependency with "Optional" or "Many"', () => {
      class A {}

      class B {
        constructor(@WithNew() @Optional(A) public readonly a?: A) {}
      }

      class C {
        constructor(@WithNew() @Many(A) public readonly a: A[]) {}
      }

      const j = new Injector([[B], [C]]);
      expect(j.get(B).a).toBeNull();
      expect(j.get(C).a).toEqual([]);
    });

    it('support removed from parent injector', () => {
      const j = new Injector();
      const c = j.createChild();
      expect((j as any)._children.length).toBe(1);

      c.dispose();
      expect((j as any)._children.length).toBe(0);
    });
  });

  describe('forwardRef', () => {
    it('should throw Error when forwardRef is not used', () => {
      expectToThrow(() => {
        class A {
          // @ts-expect-error for testing purpose
          // eslint-disable-next-line ts/no-use-before-define
          constructor(@Inject(B) private _b: B) {}

          get key(): string {
            return typeof this._b === 'undefined' ? 'undefined' : `a${this._b.key}`;
          }
        }

        class B {
          key = 'b';
        }
      }, `Cannot access 'B' before initialization`);
    });

    it('should work when "forwardRef" is used', () => {
      class A {
        constructor(@Inject(forwardRef(() => B)) private _b: B) {}

        get key(): string {
          return typeof this._b === 'undefined' ? 'undefined' : `a${this._b.key}`;
        }
      }

      class B {
        key = 'b';
      }

      const j = new Injector([[A], [B]]);
      expect(j.get(A).key).toBe('ab');
    });
  });

  describe('non singleton', () => {
    it('should work with "WithNew" - classes', () => {
      let c = 0;

      class A {
        count = c++;
      }

      class B {
        constructor(@WithNew() @Inject(A) private readonly _a: A) {}

        get(): number {
          return this._a.count;
        }
      }

      const j = new Injector([[A], [B]]);
      const b1 = j.createInstance(B);
      const b2 = j.createInstance(B);

      expect(b1.get()).toBe(0);
      expect(b2.get()).toBe(1);
    });

    it('should work with "WithNew" - factories', () => {
      let c = 0;

      const ICount = createIdentifier<number>('ICount');

      class B {
        constructor(@WithNew() @Inject(ICount) public readonly count: number) {}
      }

      const j = new Injector([[B], [ICount, { useFactory: () => c++ }]]);

      const b1 = j.createInstance(B);
      const b2 = j.createInstance(B);

      expect(b1.count).toBe(0);
      expect(b2.count).toBe(1);
    });

    it('should work with "WithNew" - factories requiring new deps', () => {
      let c = 0;

      class A {
        readonly count: number;

        constructor() {
          this.count = c++;
        }
      }

      const ICount = createIdentifier<number>('ICount');

      class B {
        constructor(@WithNew() @Inject(ICount) public readonly count: number) {}
      }

      const j = new Injector([
        [B],
        [
          ICount,
          {
            useFactory: (a: A) => a.count,
            deps: [[new WithNew(), A]],
          },
        ],
      ]);
      j.add([A]);

      const b1 = j.createInstance(B);
      const b2 = j.createInstance(B);

      expect(b1.count).toBe(0);
      expect(b2.count).toBe(1);
    });
  });

  describe('hooks', () => {
    it('should "onInstantiation" work for class dependencies', () => {
      interface A {
        key: string;

        getAnotherKey: () => string;
      }

      let flag = false;

      const aI = createIdentifier<A>('aI');

      class A1 implements A {
        key = 'a';

        constructor() {
          flag = true;
        }

        getAnotherKey(): string {
          return `another ${this.key}`;
        }
      }

      class B {
        constructor(@Inject(aI) private _a: A) {}

        get key(): string {
          return `${this._a.key}b`;
        }

        getAnotherKey(): string {
          return `${this._a.getAnotherKey()}b`;
        }

        setKey(): void {
          this._a.key = 'changed ';
        }
      }

      const j = new Injector([
        [B],
        [
          aI,
          {
            useClass: A1,
            lazy: true,
            onInstantiation: (i: A) => (i.key = 'a++'),
          },
        ],
      ]);

      const b = j.get(B);
      expect(flag).toBeFalsy();

      expect(b.key).toBe('a++b');
      expect(flag).toBeTruthy();

      expect(b.getAnotherKey()).toBe('another a++b');

      b.setKey();

      expect(b.getAnotherKey()).toBe('another changed b');
    });

    it('should "onInstantiation" work for lazy class during', () => {
      vi.useFakeTimers();

      interface A {
        key: string;

        getAnotherKey: () => string;
      }

      let flag = false;

      const aI = createIdentifier<A>('aI');

      class A1 implements A {
        key = 'a';

        constructor() {
          flag = true;
        }

        getAnotherKey(): string {
          return `another ${this.key}`;
        }
      }

      class B {
        constructor(@Inject(aI) private _a: A) {}

        get key(): string {
          return `${this._a.key}b`;
        }

        getAnotherKey(): string {
          return `${this._a.getAnotherKey()}b`;
        }

        setKey(): void {
          this._a.key = 'changed ';
        }
      }

      const j = new Injector([
        [B],
        [
          aI,
          {
            useClass: A1,
            lazy: true,
            onInstantiation: (i: A) => (i.key = 'a++'),
          },
        ],
      ]);

      const _b = j.get(B);
      expect(flag).toBeFalsy();

      // after a period of time
      vi.runAllTimers();
      vi.runAllTicks();

      const a = j.get(aI);
      expect(flag).toBeTruthy();
      expect(a.key).toBe('a++');

      vi.useRealTimers();
    });

    it('should "onInstantiation" work for factory dependencies', () => {
      interface A {
        key: string;
      }

      const aI = createIdentifier<A>('aI');

      const j = new Injector([
        [
          aI,
          {
            useFactory: () => ({
              key: 'a',
            }),
            onInstantiation: (i: A) => (i.key = 'a++'),
          },
        ],
      ]);

      expect(j.get(aI).key).toBe('a++');
    });
  });

  describe('dispose', () => {
    it('should dispose', () => {
      let flag = false;

      // for test coverage
      class A {
        key = 'a';
      }

      class B implements IDisposable {
        constructor(@Inject(A) private readonly _a: A) {}

        get key(): string {
          return `${this._a.key}b`;
        }

        dispose() {
          flag = true;
        }
      }

      const j = new Injector([[A], [B]]);
      j.get(B);

      j.dispose();

      expect(flag).toBeTruthy();
    });

    it('should throw error when called after disposing', () => {
      class A {}

      const j = new Injector();
      j.dispose();

      expectToThrow(() => j.get(A), 'Injector cannot be accessed after it was disposed.');
    });
  });

  describe('lookup', () => {
    it('should support optional lookup even if parent does not exist', () => {
      class A {}

      const parentInjector = new Injector();
      const childInjector = parentInjector.createChild([[A]]);

      expect(childInjector.get(A, Quantity.OPTIONAL, LookUp.SKIP_SELF)).toBeNull();
    });
  });

  it('should return the cached decorator with the same name', () => {
    const decorator = createIdentifier('a');
    expect(createIdentifier('a')).toBe(decorator);
  });

  describe('test "onDispose" callback', () => {
    it('should be called when the Injector is disposed', () => {
      let disposed = false;
      let disposed2 = false;

      const j = new Injector();
      j.onDispose(() => (disposed = true));

      const disposable = j.onDispose(() => (disposed2 = true));
      disposable.dispose();

      j.dispose();
      expect(disposed).toBe(true);
      expect(disposed2).toBe(false);
    });
  });

  describe('docs cases', () => {
    it('person father cases', () => {
      class Person {
        constructor(
          @SkipSelf()
          @Optional(forwardRef(() => Father))
          readonly father: Father,
        ) {}
      }

      class Father extends Person {
        changeDiaper(): void {}
      }

      const parentInjector = new Injector([[Person], [Father, { useFactory: (f) => f, deps: [Person] }]]);
      const injector = parentInjector.createChild([[Person]]);
      const person = injector.get(Person);
      expect(person.father).toBe(parentInjector.get(Person));
    });
  });

  it('should print the dependencies stack when cannot resolve', () => {
    class A {}

    class B {
      constructor(@Inject(A) private _a: A) {}
    }

    class C {
      constructor(@Inject(B) private _b: B) {}
    }

    class D {
      constructor(@Inject(C) private _c: C) {}
    }

    const j = new Injector([[B], [C], [D]]);

    expectToThrow(() => j.get(D), 'Cannot find "A" registered by any injector. It is the 0th param of "B".');
  });

  it('should print the dependencies stack when cannot resolve with factory', () => {
    class A {}

    class B {
      constructor(@Inject(A) private _a: A) {}
    }

    class C {
      constructor(@Inject(B) private _b: B) {}
    }

    const f = createIdentifier('f');

    const j = new Injector([
      [B],
      [C],
      [
        f,
        {
          useFactory: () => void 0,
          deps: [C],
        },
      ],
    ]);

    expectToThrow(() => j.get(f), '[redi]: Cannot find "A" registered by any injector. It is the 0th param of "B".');
  });
});
