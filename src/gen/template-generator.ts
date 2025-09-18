/**
 * Template generation utilities for fluent builders
 * Generates code templates for builder files
 */

/**
 * Generates the common.ts file template content
 * This template is used when generating multiple builder files
 * @returns The complete template string for common.ts
 */
export function getCommonFileTemplate(): string {
  return `/**
 * Common utilities for fluent builders
 * Auto-generated - do not modify manually
 */

export const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");

export interface BaseBuildContext {
  readonly parentId?: string;
  readonly parameterName?: string;
  readonly index?: number;
  readonly [key: string]: unknown;
}

export interface FluentBuilder<T, C extends BaseBuildContext = BaseBuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  build(context?: C): T;
}

export function isFluentBuilder<T = unknown, C extends BaseBuildContext = BaseBuildContext>(
  value: unknown,
): value is FluentBuilder<T, C> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const hasSymbol = FLUENT_BUILDER_SYMBOL in value;
  if (!hasSymbol) {
    return false;
  }

  const obj = value as { [FLUENT_BUILDER_SYMBOL]: unknown; build?: unknown };

  return (
    obj[FLUENT_BUILDER_SYMBOL] === true &&
    typeof obj.build === "function"
  );
}

export function isBuilderArray<T = unknown, C extends BaseBuildContext = BaseBuildContext>(
  value: unknown,
): value is Array<FluentBuilder<T, C>> {
  return Array.isArray(value) && value.every(isFluentBuilder);
}

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

export abstract class FluentBuilderBase<T, C extends BaseBuildContext = BaseBuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL] = true;
  protected values: Partial<T> = {};
  protected builders = new Map<string, FluentBuilder<unknown, C> | Array<FluentBuilder<unknown, C>>>();
  protected context?: C;

  constructor(initial?: Partial<T>) {
    if (initial) {
      this.values = { ...initial };
    }
  }

  protected set<K extends keyof T>(key: K, value: unknown): this {
    if (isFluentBuilder(value) || isBuilderArray(value)) {
      this.builders.set(String(key), value);
    } else if (Array.isArray(value)) {
      if (value.some(isFluentBuilder)) {
        this.builders.set(String(key), value);
      } else {
        this.values[key] = value as T[K];
      }
    } else {
      this.values[key] = value as T[K];
    }
    return this;
  }

  protected buildWithDefaults(defaults?: Partial<T>, context?: C): T {
    const result: Record<string, unknown> = defaults ? { ...defaults } : {};

    Object.assign(result, this.values);

    this.builders.forEach((value, key) => {
      const nestedContext = context ? createNestedContext(context, key) : undefined;
      result[key] = resolveValue(value, nestedContext);
    });

    return result as T;
  }

  public if<K extends keyof T>(
    predicate: (builder: this) => boolean,
    property: K,
    value: T[K] | FluentBuilder<T[K], C> | (() => T[K] | FluentBuilder<T[K], C>)
  ): this {
    if (predicate(this)) {
      const resolvedValue = typeof value === 'function' && !isFluentBuilder(value)
        ? (value as () => T[K] | FluentBuilder<T[K], C>)()
        : value;
      this.set(property, resolvedValue);
    }
    return this;
  }

  public has<K extends keyof T>(key: K): boolean {
    return key in this.values || this.builders.has(String(key));
  }

  public peek<K extends keyof T>(key: K): T[K] | undefined {
    return this.values[key];
  }

  abstract build(context?: C): T;
}

export function createInspectMethod(builderName: string, properties: Record<string, unknown>): string {
  return \`\${builderName} { properties: \${JSON.stringify(properties, null, 2)} }\`;
}`;
}

/**
 * Generates utility functions template for single file output
 * Removes export keywords for inline inclusion
 * @returns The template string for single file utilities
 */
export function getSingleFileUtilitiesTemplate(): string {
  const template = getCommonFileTemplate();
  // Remove export keywords for single file inclusion
  return `
// === Fluent Builder Utilities ===
${template.replace(/^export /gm, '')}
`;
}