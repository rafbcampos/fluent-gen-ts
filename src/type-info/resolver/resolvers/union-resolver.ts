import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

/**
 * Resolves union and intersection types to their TypeInfo representation.
 */
export class UnionResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  /**
   * Resolves a union type to its TypeInfo representation.
   * @param params - The type resolution parameters
   * @returns Result containing the resolved union TypeInfo
   */
  async resolveUnion(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const unionTypes = await this.resolveCompositeTypes({
      ...params,
      getTypes: type => type.getUnionTypes(),
    });
    if (!unionTypes.ok) return unionTypes;

    return ok({
      kind: TypeKind.Union,
      unionTypes: unionTypes.value,
    });
  }

  /**
   * Resolves an intersection type to its TypeInfo representation.
   * @param params - The type resolution parameters
   * @returns Result containing the resolved intersection TypeInfo
   */
  async resolveIntersection(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const intersectionTypes = await this.resolveCompositeTypes({
      ...params,
      getTypes: type => type.getIntersectionTypes(),
    });
    if (!intersectionTypes.ok) return intersectionTypes;

    return ok({
      kind: TypeKind.Intersection,
      intersectionTypes: intersectionTypes.value,
    });
  }

  /**
   * Resolves a collection of types that form a composite type.
   * @param params - The type resolution parameters including a function to get component types
   * @returns Result containing an array of resolved TypeInfo
   */
  private async resolveCompositeTypes(params: {
    type: Type;
    depth: number;
    context: GenericContext;
    getTypes: (type: Type) => Type[];
  }): Promise<Result<TypeInfo[]>> {
    const { type, depth, context, getTypes } = params;
    const resolvedTypes: TypeInfo[] = [];

    for (const componentType of getTypes(type)) {
      const resolved = await this.resolveType(componentType, depth + 1, context);
      if (!resolved.ok) return resolved;
      resolvedTypes.push(resolved.value);
    }

    return ok(resolvedTypes);
  }
}
