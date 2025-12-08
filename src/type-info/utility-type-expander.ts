import { Type } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import type { GenericContext } from './generic-context.js';

const UTILITY_TYPE_NAMES = [
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'ConstructorParameters',
  'InstanceType',
  'Awaited',
] as const;

type UtilityTypeName = (typeof UTILITY_TYPE_NAMES)[number];

const UTILITY_TYPE_NAMES_SET: ReadonlySet<string> = new Set(UTILITY_TYPE_NAMES);

const UTILITY_TYPE_PATTERNS = new Set(UTILITY_TYPE_NAMES.map(name => `${name}<`));

function isUtilityTypeName(name: string): name is UtilityTypeName {
  return UTILITY_TYPE_NAMES_SET.has(name);
}

export interface UtilityTypeExpanderOptions {
  readonly maxDepth?: number;
  readonly genericContext?: GenericContext;
}

export interface ExpandUtilityTypeParams {
  readonly type: Type;
  readonly resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
  readonly depth?: number;
  readonly genericContext?: GenericContext;
}

/**
 * Handles utility types that haven't been resolved by TypeScript.
 *
 * In most cases, TypeScript will have already resolved utility types
 * to their result (e.g., `Pick<User, 'id'>` becomes an object with id property).
 * This expander only handles edge cases where the utility type depends on
 * unresolved generic parameters (e.g., `Pick<T, K>` where T and K are generic).
 */
export class UtilityTypeExpander {
  private readonly maxDepth: number;
  private readonly genericContext: GenericContext | undefined;

  constructor(options: UtilityTypeExpanderOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.genericContext = options.genericContext;
  }

  /**
   * Attempts to expand an unresolved utility type.
   *
   * @param params - The expansion parameters
   * @param params.type - The TypeScript type to potentially expand
   * @param params.resolveType - Function to resolve nested types
   * @param params.depth - Current recursion depth
   * @param params.genericContext - Context for tracking generic parameters
   * @returns A Result containing TypeInfo if the utility type was expanded, null if it was already resolved, or an error
   *
   * @example
   * ```ts
   * // For unresolved generic utility types like Pick<T, K>
   * const result = await expander.expandUtilityType({
   *   type: pickType,
   *   resolveType: async (t, d) => resolveTypeInfo(t, d)
   * });
   * // Returns: { kind: 'generic', name: 'Pick<T, K>' }
   * ```
   */
  async expandUtilityType(params: ExpandUtilityTypeParams): Promise<Result<TypeInfo | null>> {
    const { type, depth = 0, genericContext } = params;
    const context = genericContext ?? this.genericContext;

    if (depth > this.maxDepth) {
      return err(new Error(`Max utility type expansion depth exceeded`));
    }

    // Most utility types are already resolved by TypeScript.
    // We only need to handle unresolved cases (e.g., dependent on generic parameters).
    if (!this.isUnresolvedUtilityType(type)) {
      return ok(null);
    }

    const typeText = type.getText();

    // Check if this matches any known utility type pattern
    for (const pattern of UTILITY_TYPE_PATTERNS) {
      if (typeText.startsWith(pattern)) {
        return this.handleUnresolvedUtilityType({
          typeText,
          ...(context !== undefined && { context }),
        });
      }
    }

    // TypeScript has already resolved this utility type
    return ok(null);
  }

  private isUnresolvedUtilityType(type: Type): boolean {
    const typeText = type.getText();

    // Check if this looks like an unresolved utility type
    const hasUtilityPattern = this.hasUtilityTypePattern(typeText);
    if (!hasUtilityPattern) {
      return false;
    }

    // For most utility types, check if they have no properties (indicating unresolved)
    const properties = type.getProperties();
    const hasProperties = properties.length > 0;

    // Special case for Record types - check for index signatures
    if (typeText.startsWith('Record<')) {
      const hasIndexSignature =
        type.getStringIndexType() !== undefined || type.getNumberIndexType() !== undefined;
      return !hasIndexSignature && !hasProperties;
    }

    // For other utility types, unresolved means no properties
    return !hasProperties;
  }

  private hasUtilityTypePattern(typeText: string): boolean {
    for (const pattern of UTILITY_TYPE_PATTERNS) {
      if (typeText.startsWith(pattern)) {
        return true;
      }
    }
    return false;
  }

  private handleUnresolvedUtilityType({
    typeText,
    context,
  }: {
    typeText: string;
    context?: GenericContext;
  }): Result<TypeInfo> {
    // For unresolved utility types that depend on generic parameters,
    // we preserve them as generics that will be resolved at instantiation time.
    // This allows the builder to be generic and handle the utility type at runtime.

    // Extract generic parameters from the utility type if possible
    if (context !== undefined) {
      this.extractAndRegisterGenericParams({ typeText, context });
    }

    return ok({
      kind: TypeKind.Generic,
      name: typeText,
    });
  }

  private extractAndRegisterGenericParams({
    typeText,
    context,
  }: {
    typeText: string;
    context: GenericContext;
  }): void {
    // Extract generic parameter names from utility type patterns
    // Examples:
    // - "Partial<T>" -> ["T"]
    // - "Pick<T, K>" -> ["T", "K"]
    // - "Record<K, V>" -> ["K", "V"]

    const genericParamMatches = typeText.match(/\b[A-Z]\w*\b/g);
    if (!genericParamMatches) return;

    for (const paramName of genericParamMatches) {
      if (isUtilityTypeName(paramName)) {
        continue;
      }

      // Check if this is already a known generic parameter
      if (!context.isGenericParam(paramName)) {
        context.registerGenericParam({
          param: {
            name: paramName,
          },
        });
      }
    }
  }
}
