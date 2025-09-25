import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

export class BuiltInResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  async resolveBuiltInType(params: {
    type: Type;
    depth: number;
    context?: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const symbol = type.getSymbol();
    const typeName = symbol?.getName() ?? type.getText();

    const typeArguments = type.getTypeArguments();
    if (typeArguments && typeArguments.length > 0) {
      const resolvedTypeArgs: TypeInfo[] = [];
      for (const arg of typeArguments) {
        const resolved = await this.resolveType(arg, depth + 1, context);
        if (!resolved.ok) return resolved;
        resolvedTypeArgs.push(resolved.value);
      }

      return ok({
        kind: TypeKind.Generic,
        name: typeName,
        typeArguments: resolvedTypeArgs,
      });
    }

    return ok({
      kind: TypeKind.Primitive,
      name: typeName,
    });
  }

  resolveNodeJSBuiltInType(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const symbol = type.getSymbol();
    const typeText = type.getText();

    if (typeText.startsWith('NodeJS.')) {
      return ok({
        kind: TypeKind.Primitive,
        name: typeText,
      });
    }

    const symbolName = symbol?.getName() ?? 'unknown';
    return ok({
      kind: TypeKind.Primitive,
      name: symbolName,
    });
  }
}
