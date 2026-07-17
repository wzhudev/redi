import { describe, expect, it } from 'bun:test';
import { createIdentifier } from '../decorators';
import {
  clearResolvingStack,
  DependencyCollection,
  DependencyNotFoundError,
  DependencyNotFoundForModuleError,
  popupResolvingStack,
  pushResolvingStack,
  ResolvedDependencyCollection,
} from '../dependencyCollection';
import { Quantity } from '../types';

describe('dependency collections', () => {
  it('exercises registration and resolved-entry introspection paths', () => {
    class BareService {}

    const token = createIdentifier<number>('collection-introspection');
    const dependencies = new DependencyCollection([
      [BareService],
      [token, { useValue: 1 }],
      [token, { useValue: 2 }],
    ]);
    const registrations = dependencies.getRegistrations(token, Quantity.MANY);

    expect(registrations).toHaveLength(2);
    expect(dependencies.getRegistrations(BareService, Quantity.REQUIRED).item).toMatchObject(
      { lazy: false, useClass: BareService },
    );
    expect(dependencies.has(token)).toBe(true);
    expect(dependencies.snapshot()).toHaveLength(2);
    dependencies.delete(BareService);
    expect(dependencies.has(BareService)).toBe(false);
    dependencies.add(BareService);
    expect(
      dependencies.getRegistrations(BareService, Quantity.OPTIONAL)?.item,
    ).toMatchObject({ useClass: BareService });

    let disposed = 0;
    const resolved = new ResolvedDependencyCollection();
    resolved.add(token, 1, registrations[0].id);
    resolved.add(
      token,
      { dispose: () => disposed += 1 } as unknown as number,
      registrations[1].id,
    );
    expect(resolved.has(token)).toBe(true);
    expect(
      resolved.hasResolvedRegistration(token, registrations[0].id),
    ).toBe(true);
    expect(resolved.hasResolvedRegistration(token, 'missing')).toBe(false);
    expect(resolved.getResolvedRegistration(token, 'missing')).toBeUndefined();
    expect(resolved.getResolvedRegistration(token, registrations[1].id)?.value).toBeDefined();
    expect(resolved.entries(token)).toHaveLength(2);
    expect(resolved.entries(createIdentifier('collection-empty'))).toEqual([]);
    expect(resolved.snapshot()).toHaveLength(1);
    expect(resolved.get(token, Quantity.MANY)).toHaveLength(2);

    const singleToken = createIdentifier<number>('collection-single');
    const singleResolved = new ResolvedDependencyCollection();
    singleResolved.add(singleToken, 3);
    expect(singleResolved.get(singleToken, Quantity.REQUIRED)).toBe(3);
    expect(singleResolved.get(singleToken, Quantity.OPTIONAL)).toBe(3);
    singleResolved.dispose();

    pushResolvingStack(token);
    expect(new DependencyNotFoundError(token).message).toContain(
      'collection-introspection',
    );
    pushResolvingStack(token);
    popupResolvingStack();
    clearResolvingStack();
    expect(
      new DependencyNotFoundForModuleError(BareService, token, 0).message,
    ).toContain('BareService');

    resolved.dispose();
    expect(disposed).toBe(1);
    expect(resolved.has(token)).toBe(false);
    dependencies.dispose();
  });
});
