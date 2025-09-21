/**
 * Type utilities for working with TypeInfo structures
 * Provides helpers for flattening intersection types, collecting properties, etc.
 */

import type { TypeInfo, PropertyInfo } from '../core/types.js';
import { isIntersectionTypeInfo, isObjectTypeInfo } from './type-guards.js';

/**
 * Flattens intersection types and collects all properties from all intersected types
 * This is essential for generating proper builder methods for intersection types
 * like `Entity = Identifiable & Named & Timestamped`
 */
export function collectAllProperties(typeInfo: TypeInfo): readonly PropertyInfo[] {
  const properties = new Map<string, PropertyInfo>();

  collectPropertiesRecursive(typeInfo, properties);

  return Array.from(properties.values());
}

/**
 * Recursively collects properties from a type, handling intersection types
 */
function collectPropertiesRecursive(
  typeInfo: TypeInfo,
  properties: Map<string, PropertyInfo>,
): void {
  if (isIntersectionTypeInfo(typeInfo)) {
    // For intersection types, collect properties from all intersected types
    for (const intersectionType of typeInfo.intersectionTypes) {
      collectPropertiesRecursive(intersectionType, properties);
    }
  } else if (isObjectTypeInfo(typeInfo)) {
    // For object types, add all properties
    for (const property of typeInfo.properties) {
      // If property already exists, keep the first one (left-most in intersection wins)
      if (!properties.has(property.name)) {
        properties.set(property.name, property);
      }
    }
  }
  // For other types (Reference, Generic, etc.), we don't collect properties
  // as they should be resolved to object types before reaching this utility
}

/**
 * Checks if a type has any properties (either directly or through intersection types)
 */
export function hasProperties(typeInfo: TypeInfo): boolean {
  if (isObjectTypeInfo(typeInfo)) {
    return typeInfo.properties.length > 0;
  }

  if (isIntersectionTypeInfo(typeInfo)) {
    return typeInfo.intersectionTypes.some(hasProperties);
  }

  return false;
}

/**
 * Gets the primary object type from a type (useful for getting base type info from intersections)
 */
export function getPrimaryObjectType(typeInfo: TypeInfo): TypeInfo | null {
  if (isObjectTypeInfo(typeInfo)) {
    return typeInfo;
  }

  if (isIntersectionTypeInfo(typeInfo)) {
    // Return the first object type found in the intersection
    for (const intersectionType of typeInfo.intersectionTypes) {
      const primaryType = getPrimaryObjectType(intersectionType);
      if (primaryType) {
        return primaryType;
      }
    }
  }

  return null;
}
