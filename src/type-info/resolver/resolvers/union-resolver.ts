import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

export class UnionResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  async resolveUnion(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const unionTypes: TypeInfo[] = [];

    for (const unionType of type.getUnionTypes()) {
      const resolved = await this.resolveType(unionType, depth + 1, context);
      if (!resolved.ok) return resolved;
      unionTypes.push(resolved.value);
    }

    return ok({
      kind: TypeKind.Union,
      unionTypes,
    });
  }

  async resolveIntersection(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const intersectionTypes: TypeInfo[] = [];

    for (const intersectionType of type.getIntersectionTypes()) {
      const resolved = await this.resolveType(intersectionType, depth + 1, context);
      if (!resolved.ok) return resolved;
      intersectionTypes.push(resolved.value);
    }

    return ok({
      kind: TypeKind.Intersection,
      intersectionTypes,
    });
  }
}
