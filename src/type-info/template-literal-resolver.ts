import { Type, ts } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { formatError } from '../core/utils/error-utils.js';

/**
 * Configuration options for TemplateLiteralResolver.
 */
export interface TemplateLiteralResolverOptions {
  /** Maximum recursion depth for resolving nested template literals (default: 10) */
  readonly maxDepth?: number;
  /** Maximum number of string combinations to generate (default: 1000) */
  readonly maxCombinations?: number;
}

/**
 * Parameters for resolving template literal types.
 */
export interface TemplateLiteralResolveParams {
  /** The TypeScript type to resolve */
  readonly type: Type;
  /** Function to resolve placeholder types within the template literal */
  readonly resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
  /** Current recursion depth (default: 0) */
  readonly depth?: number;
}

interface TemplateLiteralStructure {
  readonly texts: readonly string[];
  readonly types: readonly ts.Type[];
}

/**
 * Resolves TypeScript template literal types into concrete type representations.
 * Handles template literals with placeholders by expanding them into unions of literal types.
 *
 * @example
 * ```ts
 * // Given: type Greeting<T> = `Hello ${T}`
 * // With T = "World" | "TypeScript"
 * // Resolves to: "Hello World" | "Hello TypeScript"
 * ```
 */
export class TemplateLiteralResolver {
  private readonly maxDepth: number;
  private readonly maxCombinations: number;

  constructor(options: TemplateLiteralResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.maxCombinations = options.maxCombinations ?? 1000;
  }

  /**
   * Resolves a template literal type into a concrete TypeInfo representation.
   *
   * @param params - Resolution parameters
   * @param params.type - The type to resolve
   * @param params.resolveType - Function to resolve placeholder types
   * @param params.depth - Current recursion depth (default: 0)
   * @returns Result containing the resolved TypeInfo, null if not a template literal, or an error
   */
  async resolveTemplateLiteral(
    params: TemplateLiteralResolveParams,
  ): Promise<Result<TypeInfo | null>> {
    const { type, resolveType, depth = 0 } = params;
    if (depth > this.maxDepth) {
      return err(new Error(`Max template literal resolution depth exceeded`));
    }

    try {
      if (!this.isTemplateLiteralType(type)) {
        return ok(null);
      }

      const templateStructure = this.extractTemplateLiteralStructure(type);
      if (!templateStructure) {
        return ok(null);
      }

      if (templateStructure.types.length === 0) {
        return ok({
          kind: TypeKind.Literal,
          literal: templateStructure.texts[0] || '',
        });
      }

      const expandedValues = await this.expandTemplateLiteralValues({
        templateStructure,
        resolveType,
        depth,
      });
      if (!expandedValues.ok) return expandedValues;

      if (expandedValues.value.length === 0) {
        return ok({
          kind: TypeKind.Generic,
          name: type.getText(),
        });
      }

      if (expandedValues.value.length === 1) {
        return ok({
          kind: TypeKind.Literal,
          literal: expandedValues.value[0],
        });
      }

      const unionTypes: TypeInfo[] = expandedValues.value.map(value => ({
        kind: TypeKind.Literal,
        literal: value,
      }));

      return ok({
        kind: TypeKind.Union,
        unionTypes,
      });
    } catch (error) {
      const errorMessage = formatError(error);
      return err(new Error(`Failed to resolve template literal type: ${errorMessage}`));
    }
  }

  private isTemplateLiteralType(type: Type): boolean {
    const compilerType = type.compilerType;
    return !!(compilerType.flags & ts.TypeFlags.TemplateLiteral);
  }

  private extractTemplateLiteralStructure(type: Type): TemplateLiteralStructure | null {
    const compilerType = type.compilerType;

    if (!this.hasTemplateLiteralStructure(compilerType)) {
      return null;
    }

    return {
      texts: compilerType.texts || [],
      types: compilerType.types || [],
    };
  }

  private hasTemplateLiteralStructure(
    compilerType: ts.Type,
  ): compilerType is ts.TemplateLiteralType {
    return 'texts' in compilerType && 'types' in compilerType;
  }

  private async expandTemplateLiteralValues(params: {
    readonly templateStructure: TemplateLiteralStructure;
    readonly resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
    readonly depth: number;
  }): Promise<Result<string[]>> {
    const { templateStructure, resolveType, depth } = params;

    if (templateStructure.types.length === 0) {
      return ok([templateStructure.texts[0] || '']);
    }

    const resolvedTypes: string[][] = [];
    let totalCombinations = 1;

    for (const placeholderType of templateStructure.types) {
      const typeWrapper = this.wrapCompilerType(placeholderType);
      const resolved = await resolveType(typeWrapper, depth + 1);

      if (!resolved.ok) {
        return ok([]);
      }

      const values = this.extractStringValues(resolved.value);
      if (values.length === 0) {
        return ok([]);
      }

      totalCombinations *= values.length;
      if (totalCombinations > this.maxCombinations) {
        return err(
          new Error(
            `Template literal would generate ${totalCombinations} combinations, exceeding max of ${this.maxCombinations}`,
          ),
        );
      }

      resolvedTypes.push(values);
    }

    return ok(this.generateTemplateCombinations(templateStructure.texts, resolvedTypes));
  }

  /**
   * Wraps a TypeScript compiler type as a ts-morph Type for compatibility.
   * Note: This creates a minimal wrapper that only includes the compilerType property.
   * It should only be used with functions that only access compilerType.
   */
  private wrapCompilerType(compilerType: ts.Type): Type {
    return { compilerType } as Type;
  }

  private extractStringValues(typeInfo: TypeInfo): string[] {
    switch (typeInfo.kind) {
      case TypeKind.Literal:
        return [String(typeInfo.literal)];
      case TypeKind.Union:
        return typeInfo.unionTypes.flatMap(unionType => this.extractStringValues(unionType));
      case TypeKind.Primitive:
        return [];
      default:
        return [];
    }
  }

  private generateTemplateCombinations(
    texts: readonly string[],
    resolvedTypes: readonly string[][],
  ): string[] {
    if (resolvedTypes.length === 0) {
      return [texts[0] || ''];
    }

    const combinations: string[] = [];

    const generateCombination = (index: number, current: string): void => {
      if (index >= resolvedTypes.length) {
        combinations.push(current + (texts[index] || ''));
        return;
      }

      const currentResolvedTypes = resolvedTypes[index];
      if (!currentResolvedTypes || currentResolvedTypes.length === 0) {
        return;
      }

      for (const value of currentResolvedTypes) {
        const nextCurrent = current + (texts[index] || '') + value;
        generateCombination(index + 1, nextCurrent);
      }
    };

    generateCombination(0, '');
    return combinations;
  }
}
