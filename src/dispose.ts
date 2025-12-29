/**
 * An interface for objects that hold resources which should be released
 * when they are no longer needed.
 *
 * When an injector is disposed, it will call `dispose()` on all
 * instantiated dependencies that implement this interface.
 *
 * @example
 * ```typescript
 * class DatabaseConnection implements IDisposable {
 *   private connection: Connection;
 *
 *   async connect() {
 *     this.connection = await createConnection();
 *   }
 *
 *   dispose() {
 *     this.connection?.close();
 *   }
 * }
 *
 * const injector = new Injector([[DatabaseConnection]]);
 * const db = injector.get(DatabaseConnection);
 *
 * // When done, dispose the injector to clean up resources
 * injector.dispose(); // Calls db.dispose() automatically
 * ```
 */
export interface IDisposable {
  /** Release any resources held by this object. */
  dispose: () => void;
}

/**
 * Type guard to check if a value implements the IDisposable interface.
 *
 * @param thing - The value to check.
 * @returns `true` if the value has a `dispose` method.
 */
export function isDisposable(thing: unknown): thing is IDisposable {
  return !!thing && typeof (thing as any).dispose === 'function';
}
