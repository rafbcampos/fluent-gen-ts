import { Type, ts } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';

export interface TemplateLiteralResolverOptions {
  readonly maxDepth?: number;
}

export interface TemplateLiteralResolveParams {
  readonly type: Type;
  readonly resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
  readonly depth?: number;
}

interface TemplateLiteralStructure {
  readonly texts: readonly string[];
  readonly types: readonly ts.Type[];
}

export class TemplateLiteralResolver {
  private readonly maxDepth: number;

  constructor(options: TemplateLiteralResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

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
      // Extract template literal structure using TypeScript's internal representation
      const templateStructure = this.extractTemplateLiteralStructure(type);
      if (!templateStructure) {
        return ok(null);
      }

      // If it's a simple template literal without placeholders, return as a literal type
      if (templateStructure.types.length === 0) {
        return ok({
          kind: TypeKind.Literal,
          literal: templateStructure.texts[0] || '',
        });
      }

      // For template literals with placeholders, resolve the placeholders
      const expandedValues = await this.expandTemplateLiteralValues({
        templateStructure,
        resolveType,
        depth,
      });
      if (!expandedValues.ok) return expandedValues;

      if (expandedValues.value.length === 0) {
        // If we couldn't expand to concrete values, return as generic template literal
        return ok({
          kind: TypeKind.Generic,
          name: type.getText(),
        });
      }

      if (expandedValues.value.length === 1) {
        // Single concrete value
        return ok({
          kind: TypeKind.Literal,
          literal: expandedValues.value[0],
        });
      }

      // Multiple possible values - return as a union of literals
      const unionTypes: TypeInfo[] = expandedValues.value.map(value => ({
        kind: TypeKind.Literal,
        literal: value,
      }));

      return ok({
        kind: TypeKind.Union,
        unionTypes,
      });
    } catch (error) {
      return err(new Error(`Failed to resolve template literal type: ${error}`));
    }
  }

  private isTemplateLiteralType(type: Type): boolean {
    const compilerType = type.compilerType as ts.Type;
    return !!(compilerType.flags & ts.TypeFlags.TemplateLiteral);
  }

  private extractTemplateLiteralStructure(type: Type): TemplateLiteralStructure | null {
    const compilerType = type.compilerType as ts.TemplateLiteralType;

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
      // No placeholders, just return the single text
      return ok([templateStructure.texts[0] || '']);
    }

    // Try to resolve each placeholder type to concrete values
    const resolvedTypes: string[][] = [];

    for (const placeholderType of templateStructure.types) {
      const typeWrapper = { compilerType: placeholderType } as Type;
      const resolved = await resolveType(typeWrapper, depth + 1);

      if (!resolved.ok) {
        // If we can't resolve a placeholder, we can't expand the template
        return ok([]);
      }

      const values = this.extractStringValues(resolved.value);
      if (values.length === 0) {
        // If we can't get concrete string values, we can't expand
        return ok([]);
      }

      resolvedTypes.push(values);
    }

    // Generate all combinations of the resolved values
    return ok(this.generateTemplateCombinations(templateStructure.texts, resolvedTypes));
  }

  private extractStringValues(typeInfo: TypeInfo): string[] {
    switch (typeInfo.kind) {
      case TypeKind.Literal:
        return [String(typeInfo.literal)];
      case TypeKind.Union:
        return typeInfo.unionTypes.flatMap(unionType => this.extractStringValues(unionType));
      case TypeKind.Primitive:
        // Can't extract concrete values from primitive types
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
        // Add the final text segment
        combinations.push(current + (texts[index] || ''));
        return;
      }

      const currentResolvedTypes = resolvedTypes[index];
      if (!currentResolvedTypes) return;

      for (const value of currentResolvedTypes) {
        const nextCurrent = current + (texts[index] || '') + value;
        generateCombination(index + 1, nextCurrent);
      }
    };

    generateCombination(0, '');
    return combinations;
  }
}
