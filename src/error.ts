/**
 * Base error class for all errors thrown by redi.
 *
 * All error messages are prefixed with `[redi]:` for easy identification.
 *
 * @example
 * ```typescript
 * try {
 *   injector.get(UnregisteredService);
 * } catch (error) {
 *   if (error instanceof RediError) {
 *     console.error('Redi error:', error.message);
 *   }
 * }
 * ```
 */
export class RediError extends Error {
  constructor(message: string) {
    super(`[redi]: ${message}`);
  }
}
