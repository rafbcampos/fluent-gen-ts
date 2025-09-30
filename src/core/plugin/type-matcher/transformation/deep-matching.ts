import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import type { TypeMatcher } from '../matcher-base.js';
import {
  hasProperties,
  hasUnionTypes,
  hasElementType,
  getIntersectionTypes,
} from '../type-guards.js';

/**
 * Checks if a type contains a matching type at any depth in its structure
 *
 * Recursively searches through:
 * - Array element types
 * - Object property types
 * - Union/Intersection members
 * - Tuple elements
 *
 * @param typeInfo - The type to search within
 * @param matcher - The type matcher to use for matching
 * @returns true if any nested type matches
 *
 * @example
 * ```typescript
 * const complexType: TypeInfo = {
 *   kind: TypeKind.Object,
 *   properties: [{
 *     name: 'data',
 *     type: {
 *       kind: TypeKind.Array,
 *       elementType: { kind: TypeKind.Primitive, name: 'string' }
 *     }
 *   }]
 * };
 *
 * containsTypeDeep(complexType, primitive('string')) // Returns true
 * containsTypeDeep(complexType, primitive('number')) // Returns false
 * ```
 */
export function containsTypeDeep(typeInfo: TypeInfo, matcher: TypeMatcher): boolean {
  // Check current level
  if (matcher.match(typeInfo)) {
    return true;
  }

  // Recursively check nested types
  switch (typeInfo.kind) {
    case TypeKind.Array:
      if (hasElementType(typeInfo)) {
        return containsTypeDeep(typeInfo.elementType, matcher);
      }
      return false;

    case TypeKind.Object:
      if (hasProperties(typeInfo)) {
        return typeInfo.properties.some(prop => containsTypeDeep(prop.type, matcher));
      }
      return false;

    case TypeKind.Union:
      if (hasUnionTypes(typeInfo)) {
        return typeInfo.unionTypes.some(t => containsTypeDeep(t, matcher));
      }
      return false;

    case TypeKind.Intersection: {
      const types = getIntersectionTypes(typeInfo);
      if (types) {
        return types.some(t => containsTypeDeep(t, matcher));
      }
      return false;
    }

    case TypeKind.Tuple:
      if ('elements' in typeInfo && Array.isArray(typeInfo.elements)) {
        return typeInfo.elements.some(e => containsTypeDeep(e, matcher));
      }
      return false;

    default:
      return false;
  }
}

/**
 * Finds all types matching the given matcher at any depth in the type structure
 *
 * @param typeInfo - The type to search within
 * @param matcher - The type matcher to use for matching
 * @returns Array of all matching TypeInfo objects found at any depth
 *
 * @example
 * ```typescript
 * const complexType: TypeInfo = {
 *   kind: TypeKind.Union,
 *   unionTypes: [
 *     { kind: TypeKind.Primitive, name: 'string' },
 *     {
 *       kind: TypeKind.Array,
 *       elementType: { kind: TypeKind.Primitive, name: 'string' }
 *     }
 *   ]
 * };
 *
 * const strings = findTypesDeep(complexType, primitive('string'));
 * // Returns [{ kind: 'primitive', name: 'string' }, { kind: 'primitive', name: 'string' }]
 * ```
 */
export function findTypesDeep(typeInfo: TypeInfo, matcher: TypeMatcher): TypeInfo[] {
  const results: TypeInfo[] = [];

  function collect(type: TypeInfo): void {
    if (matcher.match(type)) {
      results.push(type);
    }

    switch (type.kind) {
      case TypeKind.Array:
        if (hasElementType(type)) {
          collect(type.elementType);
        }
        break;

      case TypeKind.Object:
        if (hasProperties(type)) {
          for (const prop of type.properties) {
            collect(prop.type);
          }
        }
        break;

      case TypeKind.Union:
        if (hasUnionTypes(type)) {
          for (const t of type.unionTypes) {
            collect(t);
          }
        }
        break;

      case TypeKind.Intersection: {
        const types = getIntersectionTypes(type);
        if (types) {
          for (const t of types) {
            collect(t);
          }
        }
        break;
      }

      case TypeKind.Tuple:
        if ('elements' in type && Array.isArray(type.elements)) {
          for (const e of type.elements) {
            collect(e);
          }
        }
        break;
    }
  }

  collect(typeInfo);
  return results;
}
