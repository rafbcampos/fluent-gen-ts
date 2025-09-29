import { Type, ts } from 'ts-morph';
import { ok, err, type Result } from '../core/result.js';
import { TypeKind, type TypeInfo } from '../core/types.js';
import type { GenericContext } from './generic-context.js';

/**
 * Configuration options for the ConditionalTypeResolver.
 */
export interface ConditionalTypeResolverOptions {
  /** Maximum recursion depth to prevent infinite loops (default: 10) */
  readonly maxDepth?: number;
  /** Generic context for tracking generic parameters */
  readonly genericContext?: GenericContext;
}

/**
 * Parameters for resolving conditional types.
 */
export interface ResolveConditionalTypeParams {
  /** The TypeScript type to analyze for conditional resolution */
  readonly type: Type;
  /** Current recursion depth (used internally for depth limiting) */
  readonly depth?: number;
}

/**
 * Handles conditional types that haven't been resolved by TypeScript.
 *
 * In most cases, TypeScript will have already resolved conditional types
 * to their result (e.g., `T extends string ? true : false` becomes `true`
 * when T is string). This resolver only handles edge cases where the
 * conditional depends on unresolved generic parameters.
 */
export class ConditionalTypeResolver {
  private readonly maxDepth: number;
  private readonly genericContext: GenericContext | undefined;

  /** Pre-compiled regex for extracting generic parameter names from conditional types */
  private static readonly GENERIC_PARAM_PATTERN =
    /^([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\s+extends/;

  /**
   * Creates a new ConditionalTypeResolver instance.
   *
   * @param options - Configuration options for the resolver
   */
  constructor(options: ConditionalTypeResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.genericContext = options.genericContext;
  }

  /**
   * Resolves conditional types that haven't been resolved by TypeScript.
   *
   * Most conditional types are already resolved by TypeScript at compile time.
   * This method handles edge cases where conditionals depend on unresolved
   * generic parameters and returns them as Generic types for builder generation.
   *
   * @param params - The parameters for resolution including type and depth
   * @returns Promise resolving to Result containing TypeInfo for unresolved conditionals, null for resolved ones, or error
   *
   * @example
   * ```typescript
   * // For unresolved: T extends string ? number : boolean
   * const result = await resolver.resolveConditionalType({ type });
   * // Returns: { kind: TypeKind.Generic, name: "T extends string ? number : boolean" }
   *
   * // For resolved: "hello" extends string ? number : boolean (becomes number)
   * const result = await resolver.resolveConditionalType({ type });
   * // Returns: null (already resolved by TypeScript)
   * ```
   */
  async resolveConditionalType(
    params: ResolveConditionalTypeParams,
  ): Promise<Result<TypeInfo | null>> {
    const { type, depth = 0 } = params;

    if (!type) {
      return err(new Error('Type parameter is required'));
    }

    if (depth > this.maxDepth) {
      return err(new Error(`Max conditional type resolution depth exceeded`));
    }

    if (!this.isUnresolvedConditionalType(type)) {
      return ok(null);
    }

    return this.handleUnresolvedConditional(type);
  }

  private isUnresolvedConditionalType(type: Type): boolean {
    const tsType = type.compilerType;
    if (!tsType || typeof tsType.flags !== 'number') {
      return false;
    }
    return !!(tsType.flags & ts.TypeFlags.Conditional);
  }

  private handleUnresolvedConditional(type: Type): Result<TypeInfo | null> {
    let typeText: string;
    try {
      typeText = type.getText();
    } catch (error) {
      return err(
        new Error(
          `Failed to get type text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }

    const typeInfo: TypeInfo = {
      kind: TypeKind.Generic,
      name: typeText,
    };

    if (this.genericContext) {
      const genericParamMatch = typeText.match(ConditionalTypeResolver.GENERIC_PARAM_PATTERN);
      if (genericParamMatch && genericParamMatch[1]) {
        const paramName = genericParamMatch[1];

        if (this.genericContext.isGenericParam(paramName)) {
          return ok({
            kind: TypeKind.Generic,
            name: paramName,
          });
        }
      }
    }

    return ok(typeInfo);
  }
}
