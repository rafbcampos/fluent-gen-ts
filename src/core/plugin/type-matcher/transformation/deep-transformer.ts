import type { TypeInfo } from '../../../types.js';
import type { TypeMatcher } from '../matcher-base.js';
import {
  type TypeTransformer,
  type TransformTypeDeepOptions,
  transformTypeDeep,
} from './transform-deep.js';
import { containsTypeDeep, findTypesDeep } from './deep-matching.js';

/**
 * Context information for type transformation predicates
 */
export interface TypeTransformContext {
  /** Current type being examined */
  readonly type: TypeInfo;
  /** Depth in the type tree (0 = root) */
  readonly depth: number;
  /** Path from root to current type (property names or array indices) */
  readonly path: readonly string[];
}

/**
 * Fluent API for deep type transformations with chained replacements
 *
 * @example
 * ```typescript
 * const transformer = new TypeDeepTransformer(propertyType)
 *   .replace(primitive('string'), 'string | { value: string }')
 *   .replace(primitive('number'), 'number | { value: number }')
 *   .withBuilderTypes() // Enable FluentBuilder unions
 *   .toString();
 * ```
 */
export class TypeDeepTransformer {
  private replacements: Array<{
    predicate: (ctx: TypeTransformContext) => boolean;
    replacement: string | ((type: TypeInfo) => string);
  }> = [];
  private options: TransformTypeDeepOptions = { includeBuilderTypes: true };

  constructor(private readonly typeInfo: TypeInfo) {}

  /**
   * Replace all occurrences of types matching the given matcher
   *
   * @param matcher - Type matcher to identify types to replace
   * @param replacement - Replacement string or function
   * @returns This transformer for chaining
   *
   * @example
   * ```typescript
   * transformer.replace(primitive('string'), 'string | { value: string }')
   * transformer.replace(object('User'), type => `Enhanced${type.name}`)
   * ```
   */
  replace(
    matcher: TypeMatcher,
    replacement: string | ((type: TypeInfo) => string),
  ): TypeDeepTransformer {
    this.replacements.push({
      predicate: ctx => matcher.match(ctx.type),
      replacement,
    });
    return this;
  }

  /**
   * Replace types matching a custom predicate
   *
   * @param predicate - Function to determine if type should be replaced
   * @param replacement - Replacement string or function
   * @returns This transformer for chaining
   *
   * @example
   * ```typescript
   * transformer.replaceIf(
   *   (type, depth) => depth > 2 && type.kind === TypeKind.Primitive,
   *   'unknown'
   * )
   * ```
   */
  replaceIf(
    predicate: (type: TypeInfo, depth: number, path: readonly string[]) => boolean,
    replacement: string | ((type: TypeInfo) => string),
  ): TypeDeepTransformer {
    this.replacements.push({
      predicate: ctx => predicate(ctx.type, ctx.depth, ctx.path),
      replacement,
    });
    return this;
  }

  /**
   * Configure builder type generation options
   *
   * @param options - Options for builder type generation
   * @returns This transformer for chaining
   */
  withOptions(options: TransformTypeDeepOptions): TypeDeepTransformer {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Execute transformations and return the resulting type string
   *
   * @returns Transformed type as a string
   */
  toString(): string {
    const transformer: TypeTransformer = {
      onAny: (type: TypeInfo) => {
        // Create context for predicate evaluation
        // Note: depth and path are tracked during traversal, using 0 and [] as defaults here
        const ctx: TypeTransformContext = {
          type,
          depth: 0,
          path: [],
        };

        // Check replacements in order
        for (const rule of this.replacements) {
          if (rule.predicate(ctx)) {
            return typeof rule.replacement === 'string' ? rule.replacement : rule.replacement(type);
          }
        }

        return null; // Continue with default transformation
      },
    };

    return transformTypeDeep(this.typeInfo, transformer, this.options);
  }

  /**
   * Check if the type contains a match for the given matcher at any depth
   *
   * @param matcher - Type matcher to search for
   * @returns true if any nested type matches
   */
  hasMatch(matcher: TypeMatcher): boolean {
    return containsTypeDeep(this.typeInfo, matcher);
  }

  /**
   * Find all types matching the given matcher at any depth
   *
   * @param matcher - Type matcher to search for
   * @returns Array of all matching types
   */
  findMatches(matcher: TypeMatcher): TypeInfo[] {
    return findTypesDeep(this.typeInfo, matcher);
  }
}
