/**
 * Specifies how many instances of a dependency should be retrieved.
 *
 * - `REQUIRED`: Exactly one instance must exist (default behavior)
 * - `OPTIONAL`: Zero or one instance, returns `null` if not found
 * - `MANY`: All registered instances as an array
 */
export enum Quantity {
  /** Retrieve all registered instances as an array. */
  MANY = 'many',
  /** Retrieve zero or one instance. Returns `null` if not registered. */
  OPTIONAL = 'optional',
  /** Exactly one instance must be registered (default). Throws if not found. */
  REQUIRED = 'required',
}

/**
 * Specifies which injectors should be searched when resolving a dependency.
 *
 * - `SELF`: Only search the current injector
 * - `SKIP_SELF`: Skip the current injector, start from parent
 */
export enum LookUp {
  /** Only search in the current injector, do not look in parent injectors. */
  SELF = 'self',
  /** Skip the current injector and start searching from the parent injector. */
  SKIP_SELF = 'skipSelf',
}
