import type { TypeInfo } from '../../types.js';

/**
 * Type guards for common TypeInfo property checks
 */

export function hasName(typeInfo: TypeInfo): typeInfo is TypeInfo & { name: string } {
  return 'name' in typeInfo && typeof typeInfo.name === 'string';
}

export function hasProperties(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { properties: Array<{ name: string; type: TypeInfo }> } {
  return 'properties' in typeInfo && Array.isArray(typeInfo.properties);
}

export function hasGenericParams(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { genericParams: TypeInfo[] } {
  return 'genericParams' in typeInfo && Array.isArray(typeInfo.genericParams);
}

export function hasUnionTypes(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { unionTypes: TypeInfo[] } {
  return 'unionTypes' in typeInfo && Array.isArray(typeInfo.unionTypes);
}

export function hasElementType(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { elementType: TypeInfo } {
  return 'elementType' in typeInfo && typeInfo.elementType != null;
}

export function hasLiteralValue(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { value?: unknown; literal?: unknown } {
  return 'value' in typeInfo || 'literal' in typeInfo;
}

export function getIntersectionTypes(typeInfo: TypeInfo): TypeInfo[] | null {
  if ('types' in typeInfo && Array.isArray(typeInfo.types)) {
    return typeInfo.types;
  }
  if ('intersectionTypes' in typeInfo && Array.isArray(typeInfo.intersectionTypes)) {
    return typeInfo.intersectionTypes;
  }
  return null;
}

export function getLiteralValue(typeInfo: TypeInfo): unknown {
  if ('value' in typeInfo) return typeInfo.value;
  if ('literal' in typeInfo) return typeInfo.literal;
  return undefined;
}
