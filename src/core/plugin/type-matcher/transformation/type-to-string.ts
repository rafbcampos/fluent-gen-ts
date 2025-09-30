import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import {
  hasName,
  hasProperties,
  hasGenericParams,
  hasUnionTypes,
  hasElementType,
  hasLiteralValue,
  getIntersectionTypes,
  getLiteralValue,
} from '../type-guards.js';

/**
 * Converts a TypeInfo object to its string representation
 *
 * @param typeInfo - The TypeInfo to convert
 * @returns String representation of the type
 *
 * @example
 * ```typescript
 * const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
 * typeInfoToString(typeInfo) // Returns 'string'
 *
 * const arrayType: TypeInfo = {
 *   kind: TypeKind.Array,
 *   elementType: { kind: TypeKind.Primitive, name: 'number' }
 * };
 * typeInfoToString(arrayType) // Returns 'Array<number>'
 * ```
 */
export function typeInfoToString(typeInfo: TypeInfo): string {
  switch (typeInfo.kind) {
    case TypeKind.Primitive:
      return hasName(typeInfo) ? typeInfo.name : 'unknown';

    case TypeKind.Array:
      if (!hasElementType(typeInfo)) {
        return 'Array<unknown>';
      }
      return `Array<${typeInfoToString(typeInfo.elementType)}>`;

    case TypeKind.Object: {
      if (hasName(typeInfo) && typeInfo.name) {
        // Named object type
        if (hasGenericParams(typeInfo) && typeInfo.genericParams.length > 0) {
          const params = typeInfo.genericParams
            .map(p => ('name' in p && typeof p.name === 'string' ? p.name : 'unknown'))
            .join(', ');
          return `${typeInfo.name}<${params}>`;
        }
        return typeInfo.name;
      }

      // Anonymous object type
      if (!hasProperties(typeInfo) || typeInfo.properties.length === 0) {
        return '{}';
      }

      const props = typeInfo.properties
        .map(prop => {
          const optional = prop.optional ? '?' : '';
          const readonly = prop.readonly ? 'readonly ' : '';
          const propType = typeInfoToString(prop.type);
          return `${readonly}${prop.name}${optional}: ${propType}`;
        })
        .join('; ');

      return `{ ${props} }`;
    }

    case TypeKind.Union:
      if (!hasUnionTypes(typeInfo) || typeInfo.unionTypes.length === 0) {
        return 'never';
      }
      return typeInfo.unionTypes.map(t => typeInfoToString(t)).join(' | ');

    case TypeKind.Intersection: {
      const types = getIntersectionTypes(typeInfo);
      if (!types || types.length === 0) {
        return 'unknown';
      }
      return types.map(t => typeInfoToString(t)).join(' & ');
    }

    case TypeKind.Generic:
      return hasName(typeInfo) ? typeInfo.name : 'T';

    case TypeKind.Literal: {
      if (!hasLiteralValue(typeInfo)) {
        return 'unknown';
      }
      const value = getLiteralValue(typeInfo);
      if (typeof value === 'string') {
        return `"${value}"`;
      }
      return String(value);
    }

    case TypeKind.Reference:
      return hasName(typeInfo) ? typeInfo.name : 'unknown';

    case TypeKind.Function:
      return hasName(typeInfo) && typeInfo.name ? typeInfo.name : 'Function';

    case TypeKind.Tuple:
      if ('elements' in typeInfo && Array.isArray(typeInfo.elements)) {
        const elements = typeInfo.elements.map(e => typeInfoToString(e)).join(', ');
        return `[${elements}]`;
      }
      return '[]';

    case TypeKind.Enum:
      return hasName(typeInfo) ? typeInfo.name : 'enum';

    case TypeKind.Never:
      return 'never';

    case TypeKind.Unknown:
      return 'unknown';

    default:
      return 'unknown';
  }
}
