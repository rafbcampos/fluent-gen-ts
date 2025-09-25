import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok, err } from '../../../core/result.js';
import type { TypeInfo, GenericParam } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

export class GenericResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

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

    const constraint = type.getConstraint();
    const defaultType = type.getDefault();

    let constraintInfo: TypeInfo | undefined;
    let defaultInfo: TypeInfo | undefined;

    if (constraint) {
      const constraintResult = await this.resolveType(constraint, depth + 1, context);
      if (constraintResult.ok) {
        constraintInfo = constraintResult.value;
      }
    }

    if (defaultType) {
      const defaultResult = await this.resolveType(defaultType, depth + 1, context);
      if (defaultResult.ok) {
        defaultInfo = defaultResult.value;
      }
    }

    context.registerGenericParam({
      param: {
        name: paramName,
        ...(constraintInfo && { constraint: constraintInfo }),
        ...(defaultInfo && { default: defaultInfo }),
      },
    });

    return ok({ kind: TypeKind.Generic, name: paramName });
  }

  async resolveGenericParams(params: { type: Type }): Promise<Result<GenericParam[]>> {
    const { type } = params;
    const genericParams: GenericParam[] = [];

    try {
      const symbol = type.getSymbol();
      if (!symbol) return ok(genericParams);

      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) return ok(genericParams);

      const declaration = declarations[0];
      if (!declaration) return ok(genericParams);

      if (
        'getTypeParameters' in declaration &&
        typeof declaration.getTypeParameters === 'function'
      ) {
        const typeParams = declaration.getTypeParameters() ?? [];

        for (const param of typeParams) {
          const constraint = param.getConstraint();
          const defaultType = param.getDefault();

          let constraintType: TypeInfo | undefined;
          let defaultTypeInfo: TypeInfo | undefined;

          if (constraint) {
            const constraintResult = await this.resolveType(constraint.getType(), 0);
            if (constraintResult.ok) {
              constraintType = constraintResult.value;
            }
          }

          if (defaultType) {
            const defaultResult = await this.resolveType(defaultType.getType(), 0);
            if (defaultResult.ok) {
              defaultTypeInfo = defaultResult.value;
            }
          }

          const genericParam: GenericParam = {
            name: param.getName(),
            ...(constraintType && { constraint: constraintType }),
            ...(defaultTypeInfo && { default: defaultTypeInfo }),
          };

          genericParams.push(genericParam);
        }
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
}
