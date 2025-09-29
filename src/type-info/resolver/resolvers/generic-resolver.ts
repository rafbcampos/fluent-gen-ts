import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok, err } from '../../../core/result.js';
import type { TypeInfo, GenericParam } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

/**
 * Resolves generic type parameters and their constraints to TypeInfo representation.
 */
export class GenericResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  /**
   * Resolves a type parameter to its TypeInfo representation.
   * @param params - The type resolution parameters
   * @returns Result containing the resolved generic TypeInfo
   */
  async resolveTypeParameter(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const paramName = type.getSymbol()?.getName() ?? 'T';

    const resolvedInContext = context.getResolvedType(paramName);
    if (resolvedInContext) {
      return ok(resolvedInContext);
    }

    const { constraint, default: defaultInfo } = await this.resolveConstraintAndDefault({
      constraint: type.getConstraint(),
      defaultType: type.getDefault(),
      depth,
      context,
    });

    context.registerGenericParam({
      param: {
        name: paramName,
        ...(constraint && { constraint }),
        ...(defaultInfo && { default: defaultInfo }),
      },
    });

    return ok({ kind: TypeKind.Generic, name: paramName });
  }

  /**
   * Resolves generic parameters from a type declaration.
   * @param params - The type to extract generic parameters from
   * @returns Result containing an array of resolved GenericParam
   */
  async resolveGenericParams(params: { type: Type }): Promise<Result<GenericParam[]>> {
    const { type } = params;
    const genericParams: GenericParam[] = [];

    try {
      const typeParams = this.extractTypeParameters(type);
      if (!typeParams) return ok(genericParams);

      for (const param of typeParams) {
        const constraintType = (param as any).getConstraint?.()?.getType?.();
        const defaultType = (param as any).getDefault?.()?.getType?.();

        const { constraint, default: defaultInfo } = await this.resolveConstraintAndDefault({
          constraint: constraintType,
          defaultType,
          depth: 0,
        });

        genericParams.push({
          name: (param as any).getName?.() ?? 'unknown',
          ...(constraint && { constraint }),
          ...(defaultInfo && { default: defaultInfo }),
        });
      }

      return ok(genericParams);
    } catch (error) {
      return err(
        new Error(
          `Failed to resolve generic parameters: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  /**
   * Resolves constraint and default types for a generic parameter.
   * @param params - The constraint and default types to resolve
   * @returns Object containing resolved constraint and default TypeInfo
   */
  private async resolveConstraintAndDefault(params: {
    constraint: Type | undefined;
    defaultType: Type | undefined;
    depth: number;
    context?: GenericContext;
  }): Promise<{ constraint?: TypeInfo; default?: TypeInfo }> {
    const { constraint, defaultType, depth, context } = params;
    const result: { constraint?: TypeInfo; default?: TypeInfo } = {};

    if (constraint) {
      const constraintResult = await this.resolveType(constraint, depth + 1, context);
      if (constraintResult.ok) {
        result.constraint = constraintResult.value;
      }
    }

    if (defaultType) {
      const defaultResult = await this.resolveType(defaultType, depth + 1, context);
      if (defaultResult.ok) {
        result.default = defaultResult.value;
      }
    }

    return result;
  }

  /**
   * Extracts type parameters from a type's declaration.
   * @param type - The type to extract parameters from
   * @returns Array of type parameters or undefined if none found
   */
  private extractTypeParameters(type: Type): unknown[] | undefined {
    const symbol = type.getSymbol();
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    const declaration = declarations[0];
    if (!declaration) return undefined;

    if ('getTypeParameters' in declaration && typeof declaration.getTypeParameters === 'function') {
      return declaration.getTypeParameters() ?? [];
    }

    return undefined;
  }
}
