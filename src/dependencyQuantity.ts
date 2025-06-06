import type { DependencyIdentifier } from './dependencyIdentifier';
import type { Ctor } from './dependencyItem';
import {
  getDependencyByIndex,
  IdentifierUndefinedError,
  setDependency,
} from './decorators';
import { prettyPrintIdentifier } from './dependencyItem';
import { RediError } from './error';
import { Quantity } from './types';

function mapQuantityToNumber(quantity: Quantity): string {
  switch (quantity) {
    case Quantity.OPTIONAL:
      return '0 or 1';
    case Quantity.REQUIRED:
      return '1';
    case Quantity.MANY:
      return '0 or more';
  }
}

export class QuantityCheckError extends RediError {
  constructor(
    id: DependencyIdentifier<any>,
    public readonly quantity: Quantity,
    public readonly actual: number,
  ) {
    let msg = `Expect ${mapQuantityToNumber(quantity)} dependency item(s) for id "${prettyPrintIdentifier(
      id,
    )}" but get ${actual}.`;

    if (actual === 0) {
      msg += ' Did you forget to register it?';
    }

    if (actual > 1) {
      msg += ' You register it more than once.';
    }

    super(msg);
  }
}

export function checkQuantity(
  id: DependencyIdentifier<any>,
  quantity: Quantity,
  length: number,
): void {
  if (
    (quantity === Quantity.OPTIONAL && length > 1) ||
    (quantity === Quantity.REQUIRED && length !== 1)
  ) {
    throw new QuantityCheckError(id, quantity, length);
  }
}

export function retrieveQuantity<T>(quantity: Quantity, arr: T[]): T[] | T {
  if (quantity === Quantity.MANY) {
    return arr;
  } else {
    return arr[0];
  }
}

function changeQuantity(target: Ctor<any>, index: number, quantity: Quantity) {
  const descriptor = getDependencyByIndex(target, index);
  descriptor.quantity = quantity;
}

function quantifyDecoratorFactoryProducer(quantity: Quantity) {
  return function decoratorFactory<T>(
    // typescript would remove `this` after transpilation
    // this line just declare the type of `this`
    this: any,
    id?: DependencyIdentifier<T>,
  ) {
    if (this instanceof decoratorFactory) {
      return this;
    }

    return function (registerTarget: Ctor<T>, _key: string, index: number) {
      if (id) {
        setDependency(registerTarget, id, index, quantity);
      } else {
        if (quantity === Quantity.REQUIRED) {
          throw new IdentifierUndefinedError(registerTarget, index);
        }

        changeQuantity(registerTarget, index, quantity);
      }
    };
  } as any;
}

interface ManyDecorator {
  (id?: DependencyIdentifier<any>): any;
  new (): ManyDecorator;
}
export const Many: ManyDecorator = quantifyDecoratorFactoryProducer(
  Quantity.MANY,
);

interface OptionalDecorator {
  (id?: DependencyIdentifier<any>): any;
  new (): OptionalDecorator;
}
export const Optional: OptionalDecorator = quantifyDecoratorFactoryProducer(
  Quantity.OPTIONAL,
);

interface InjectDecorator {
  (id: DependencyIdentifier<any>): any;
  new (): InjectDecorator;
}
export const Inject: InjectDecorator = quantifyDecoratorFactoryProducer(
  Quantity.REQUIRED,
);
