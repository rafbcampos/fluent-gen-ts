/**
 * Type utilities for working with TypeInfo structures.
 * Provides helpers for flattening intersection types, collecting properties, and extracting object types.
 */

import type { TypeInfo, PropertyInfo } from '../core/types.js';
import { isIntersectionTypeInfo, isObjectTypeInfo } from './type-guards.js';

/**
 * Collects all properties from a type, recursively flattening intersection types.
 *
 * When a type is an intersection (e.g., `A & B & C`), this function gathers properties
 * from all intersected types. For duplicate property names, the left-most property wins.
 *
 * @param typeInfo - The type to collect properties from
 * @returns Array of all properties found in the type and its intersections
 *
 * @example
 * ```ts
 * // Given: type Entity = Identifiable & Named & Timestamped
 * // Where:
 * //   Identifiable = { id: string }
 * //   Named = { name: string }
 * //   Timestamped = { createdAt: Date, updatedAt: Date }
 * const properties = collectAllProperties(entityType);
 * // Returns: [id, name, createdAt, updatedAt]
 * ```
 */
export function collectAllProperties(typeInfo: TypeInfo): readonly PropertyInfo[] {
  const properties = new Map<string, PropertyInfo>();

  collectPropertiesRecursive(typeInfo, properties);

  return Array.from(properties.values());
}

/**
 * Recursively collects properties from a type into the provided map.
 * Non-object and non-intersection types are ignored.
 *
 * @param typeInfo - The type to process
 * @param properties - Map to accumulate properties (mutated in place)
 */
function collectPropertiesRecursive(
  typeInfo: TypeInfo,
  properties: Map<string, PropertyInfo>,
): void {
  if (isIntersectionTypeInfo(typeInfo)) {
    for (const intersectionType of typeInfo.intersectionTypes) {
      collectPropertiesRecursive(intersectionType, properties);
    }
  } else if (isObjectTypeInfo(typeInfo)) {
    for (const property of typeInfo.properties) {
      if (!properties.has(property.name)) {
        properties.set(property.name, property);
      }
    }
  }
}

/**
 * Checks if a type contains any properties.
 *
 * Returns `true` for object types with properties or intersection types
 * containing at least one object type with properties.
 *
 * @param typeInfo - The type to check
 * @returns `true` if the type has properties, `false` otherwise
 *
 * @example
 * ```ts
 * hasProperties({ kind: 'object', properties: [{ name: 'id', ... }] }) // true
 * hasProperties({ kind: 'primitive', name: 'string' }) // false
 * ```
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
 * Extracts the first object type from a type or intersection.
 *
 * For object types, returns the type itself. For intersection types,
 * recursively searches for and returns the first object type encountered.
 * Useful for obtaining base type information from complex intersections.
 *
 * @param typeInfo - The type to extract from
 * @returns The first object type found, or `null` if none exists
 *
 * @example
 * ```ts
 * // Given: type Entity = Identifiable & Named
 * getPrimaryObjectType(entityType) // Returns: Identifiable type
 *
 * getPrimaryObjectType({ kind: 'primitive', name: 'string' }) // Returns: null
 * ```
 */
export function getPrimaryObjectType(typeInfo: TypeInfo): TypeInfo | null {
  if (isObjectTypeInfo(typeInfo)) {
    return typeInfo;
  }

  if (isIntersectionTypeInfo(typeInfo)) {
    for (const intersectionType of typeInfo.intersectionTypes) {
      const primaryType = getPrimaryObjectType(intersectionType);
      if (primaryType) {
        return primaryType;
      }
    }
  }

  return null;
}
