import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';

/**
 * Resolves array and tuple types to their TypeInfo representation.
 */
export class ArrayResolver {
  constructor(private readonly resolveType: TypeResolverFunction) {}

  /**
   * Resolves an array type to its TypeInfo representation.
   * @param params - The type resolution parameters
   * @returns Result containing the resolved array TypeInfo
   */
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

      const isReadonly = this.isReadonlyArray(type);

      return ok({
        kind: TypeKind.Array,
        elementType: resolvedElement.value,
        ...(isReadonly && { readonly: true }),
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  /**
   * Resolves a tuple type to its TypeInfo representation.
   * @param params - The type resolution parameters
   * @returns Result containing the resolved tuple TypeInfo
   */
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

    const isReadonly = this.isReadonlyArray(type);

    return ok({
      kind: TypeKind.Tuple,
      elements,
      ...(isReadonly && { readonly: true }),
    });
  }

  /**
   * Checks if an array or tuple type is readonly.
   * @param type - The type to check
   * @returns True if the array/tuple is readonly
   */
  private isReadonlyArray(type: Type): boolean {
    const typeText = type.getText();
    return typeText.startsWith('readonly ') || typeText.includes('ReadonlyArray<');
  }
}
