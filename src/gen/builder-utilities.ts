/**
 * Runtime utilities for fluent builders
 * Core functionality for builder pattern implementation
 */

/**
 * Unique symbol for identifying fluent builders
 * Used across module boundaries for proper type identification
 */
export const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");

/**
 * Base context interface for builder operations
 * Provides information about the builder's position in the object hierarchy
 */
export interface BaseBuildContext {
  /** Parent builder identifier */
  readonly parentId?: string;
  /** Name of the parameter being built */
  readonly parameterName?: string;
  /** Index in array if building array elements */
  readonly index?: number;
  /** Additional context properties */
  readonly [key: string]: unknown;
}

/**
 * Core fluent builder interface
 * All generated builders implement this interface
 */
export interface FluentBuilder<T, C extends BaseBuildContext = BaseBuildContext> {
  /** Identifies this as a fluent builder */
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  /**
   * Builds the final object
   * @param context - Optional build context
   */
  build(context?: C): T;
}

/**
 * Type guard to check if a value is a fluent builder
 * Uses Symbol.for to ensure proper identification across module boundaries
 * @param value - Value to check
 * @returns True if value is a fluent builder
 */
export function isFluentBuilder<T = unknown, C extends BaseBuildContext = BaseBuildContext>(
  value: unknown,
): value is FluentBuilder<T, C> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  // Safely check for symbol property
  const hasSymbol = FLUENT_BUILDER_SYMBOL in value;
  if (!hasSymbol) {
    return false;
  }

  // Type narrowing: at this point we know it's an object with our symbol
  const obj = value as { [FLUENT_BUILDER_SYMBOL]: unknown; build?: unknown };

  return (
    obj[FLUENT_BUILDER_SYMBOL] === true &&
    typeof obj.build === "function"
  );
}

/**
 * Type guard to check if a value is a builder array
 * @param value - Value to check
 * @returns True if value is an array of builders
 */
export function isBuilderArray<T = unknown, C extends BaseBuildContext = BaseBuildContext>(
  value: unknown,
): value is Array<FluentBuilder<T, C>> {
  return Array.isArray(value) && value.every(isFluentBuilder);
}

/**
 * Creates a new context for nested builders with proper inheritance
 * @param parentContext - Context from parent builder
 * @param parameterName - Name of the parameter being built
 * @param index - Optional array index
 * @returns New context with inherited properties
 */
export function createNestedContext<C extends BaseBuildContext>(
  parentContext: C,
  parameterName: string,
  index?: number,
): C {
  return {
    ...parentContext,
    parameterName,
    index,
  } as C;
}

/**
 * Recursively resolves builders in a value
 * @param value - Value to resolve
 * @param context - Optional build context
 * @returns Resolved value with all builders built
 */
export function resolveValue<T, C extends BaseBuildContext>(
  value: unknown,
  context?: C
): unknown {
  if (isFluentBuilder<T, C>(value)) {
    return value.build(context);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const arrayContext = context ? createNestedContext(context, 'array', index) : undefined;
      return resolveValue(item, arrayContext);
    });
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const nestedContext = context ? createNestedContext(context, key) : undefined;
      resolved[key] = resolveValue(val, nestedContext);
    }
    return resolved;
  }

  return value;
}

/**
 * Base class for all generated builders
 * Provides core functionality for the builder pattern
 */
export abstract class FluentBuilderBase<T, C extends BaseBuildContext = BaseBuildContext> {
  /** Marks this as a fluent builder */
  readonly [FLUENT_BUILDER_SYMBOL] = true;
  /** Storage for property values */
  protected values: Partial<T> = {};
  /** Storage for nested builders */
  protected builders = new Map<string, FluentBuilder<unknown, C> | Array<FluentBuilder<unknown, C>>>();
  /** Optional build context */
  protected context?: C;

  /**
   * Creates a new builder instance
   * @param initial - Optional initial values
   */
  constructor(initial?: Partial<T>) {
    if (initial) {
      this.values = { ...initial };
    }
  }

  /**
   * Sets a property value, handling both regular values and nested builders
   * @param key - The property key
   * @param value - The value or builder to set
   */
  protected set<K extends keyof T>(key: K, value: unknown): this {
    if (isFluentBuilder(value) || isBuilderArray(value)) {
      this.builders.set(String(key), value);
    } else if (Array.isArray(value)) {
      // Check if array contains any builders
      if (value.some(isFluentBuilder)) {
        this.builders.set(String(key), value);
      } else {
        // Safe assignment: we've validated it's not a builder array
        this.values[key] = value as T[K];
      }
    } else {
      // Safe assignment: we've validated it's not a builder
      this.values[key] = value as T[K];
    }
    return this;
  }

  /**
   * Builds the final object with defaults and nested builder resolution
   * @param defaults - Optional default values
   * @param context - Optional build context
   */
  protected buildWithDefaults(defaults?: Partial<T>, context?: C): T {
    const result: Record<string, unknown> = defaults ? { ...defaults } : {};

    // Apply explicitly set values
    Object.assign(result, this.values);

    // Recursively build nested builders
    this.builders.forEach((value, key) => {
      const nestedContext = context ? createNestedContext(context, key) : undefined;
      result[key] = resolveValue(value, nestedContext);
    });

    // Type assertion is safe here as we're building from typed values
    return result as T;
  }

  /**
   * Conditionally sets a property based on a predicate
   * @param predicate - Function to determine if the property should be set
   * @param property - The property key
   * @param value - The value or value generator
   */
  public if<K extends keyof T>(
    predicate: (builder: this) => boolean,
    property: K,
    value: T[K] | FluentBuilder<T[K], C> | (() => T[K] | FluentBuilder<T[K], C>)
  ): this {
    if (predicate(this)) {
      // Type guard: check if it's a function that's not a builder
      const resolvedValue = typeof value === 'function' && !isFluentBuilder(value)
        ? (value as () => T[K] | FluentBuilder<T[K], C>)()
        : value;
      this.set(property, resolvedValue);
    }
    return this;
  }

  /**
   * Checks if a property has been set
   * @param key - The property key to check
   */
  public has<K extends keyof T>(key: K): boolean {
    return key in this.values || this.builders.has(String(key));
  }

  /**
   * Get current value (useful for conditional logic)
   * @param key - The property key
   * @returns The current value or undefined
   */
  public peek<K extends keyof T>(key: K): T[K] | undefined {
    return this.values[key];
  }

  /**
   * Abstract build method to be implemented by generated builders
   * @param context - Optional build context
   */
  abstract build(context?: C): T;
}

/**
 * Creates an inspect method for better debugging experience
 * @param builderName - Name of the builder class
 * @param properties - Current builder properties
 * @returns Formatted string for inspection
 */
export function createInspectMethod(builderName: string, properties: Record<string, unknown>): string {
  return `${builderName} { properties: ${JSON.stringify(properties, null, 2)} }`;
}