import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

export class ArrayResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  async resolveArray(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const elementType = type.getArrayElementType();

    if (elementType) {
      const resolvedElement = await this.resolveType(elementType, depth + 1, context);
      if (!resolvedElement.ok) return resolvedElement;
      return ok({
        kind: TypeKind.Array,
        elementType: resolvedElement.value,
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  async resolveTuple(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const tupleElements = type.getTupleElements();
    const elements: TypeInfo[] = [];

    for (const tupleType of tupleElements) {
      const resolved = await this.resolveType(tupleType, depth + 1, context);
      if (!resolved.ok) return resolved;
      elements.push(resolved.value);
    }

    return ok({
      kind: TypeKind.Tuple,
      elements,
    });
  }
}
