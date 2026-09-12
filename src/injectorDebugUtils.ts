import type { DependencyIdentifier } from './dependencyIdentifier';
import type { DependencyItem, SyncDependencyItem } from './dependencyItem';
import type {
  InjectorDebugDependencyDescriptor,
  InjectorDebugProviderKind,
} from './injectorDebug';
import { getDependencies } from './decorators';
import { normalizeFactoryDeps } from './dependencyDescriptor';
import { normalizeForwardRef } from './dependencyForwardRef';
import {
  isAsyncDependencyItem,
  isClassDependencyItem,
  isExistingDependencyItem,
  isFactoryDependencyItem,
  isValueDependencyItem,
  prettyPrintIdentifier,
} from './dependencyItem';
import { Quantity } from './types';

export function getDebugProviderKind(
  item: SyncDependencyItem<unknown>,
): Exclude<InjectorDebugProviderKind, 'async' | 'instance'>;
export function getDebugProviderKind(
  item: DependencyItem<unknown>,
): Exclude<InjectorDebugProviderKind, 'instance'>;
export function getDebugProviderKind(
  item: DependencyItem<unknown>,
): Exclude<InjectorDebugProviderKind, 'instance'> {
  if (isValueDependencyItem(item)) return 'value';
  if (isFactoryDependencyItem(item)) return 'factory';
  if (isClassDependencyItem(item)) return 'class';
  if (isExistingDependencyItem(item)) return 'existing';
  return 'async';
}

export function getDebugProviderLabel(item: DependencyItem<unknown>): string {
  if (isValueDependencyItem(item)) return 'value';
  if (isFactoryDependencyItem(item)) return item.useFactory.name || 'factory';
  if (isClassDependencyItem(item)) return item.useClass.name;
  if (isExistingDependencyItem(item)) {
    return `alias of ${prettyPrintIdentifier(
      normalizeForwardRef(item.useExisting),
    )}`;
  }

  return 'async';
}

function normalizeDebugDependency(descriptor: {
  identifier: DependencyIdentifier<any>;
  lookUp?: InjectorDebugDependencyDescriptor['lookUp'];
  paramIndex: number;
  quantity: InjectorDebugDependencyDescriptor['quantity'];
  withNew: boolean;
}): InjectorDebugDependencyDescriptor {
  const identifier = normalizeForwardRef(descriptor.identifier);
  return {
    ...descriptor,
    identifier,
    identifierLabel: prettyPrintIdentifier(identifier),
  };
}

export function getDebugDependencies(
  item: DependencyItem<unknown>,
  loadedAsyncItem?: SyncDependencyItem<unknown>,
): readonly InjectorDebugDependencyDescriptor[] {
  if (isAsyncDependencyItem(item)) {
    return loadedAsyncItem
      ? getDebugDependencies(loadedAsyncItem)
      : Object.freeze([]);
  }

  if (isClassDependencyItem(item)) {
    return [...getDependencies(item.useClass)]
      .sort((a, b) => a.paramIndex - b.paramIndex)
      .map(normalizeDebugDependency);
  }

  if (isFactoryDependencyItem(item)) {
    return normalizeFactoryDeps(item.deps).map(normalizeDebugDependency);
  }

  if (isExistingDependencyItem(item)) {
    return [
      normalizeDebugDependency({
        identifier: item.useExisting,
        paramIndex: 0,
        quantity: Quantity.REQUIRED,
        withNew: false,
      }),
    ];
  }

  return Object.freeze([]);
}
