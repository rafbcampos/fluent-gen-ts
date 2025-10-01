import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import {
  hasName,
  hasProperties,
  hasGenericParams,
  hasUnionTypes,
  hasElementType,
  getIntersectionTypes,
} from '../type-guards.js';
import { typeInfoToString } from './type-to-string.js';

/**
 * Options for transformTypeDeep function
 */
export interface TransformTypeDeepOptions {
  /** Whether to include FluentBuilder unions for named object types */
  readonly includeBuilderTypes?: boolean;
  /** Name of the FluentBuilder type (default: 'FluentBuilder') */
  readonly builderTypeName?: string;
  /** Name of the context type (default: 'BaseBuildContext') */
  readonly contextTypeName?: string;
}

/**
 * Transformer interface for deep type transformations
 *
 * Each handler receives a type of specific kind and can return:
 * - A string to use as the transformed type
 * - A TypeInfo to continue transforming recursively
 * - null/undefined to skip transformation (preserve original)
 *
 * @example
 * ```typescript
 * import { primitive } from './matchers/primitive-matcher.js';
 *
 * const transformer: TypeTransformer = {
 *   onPrimitive: (type) => {
 *     if (primitive('string').match(type)) {
 *       return 'string | { value: string }';
 *     }
 *     return null; // preserve other primitives
 *   }
 * };
 * ```
 */
export interface TypeTransformer {
  /** Transform primitive types */
  onPrimitive?: (type: TypeInfo & { kind: TypeKind.Primitive }) => string | TypeInfo | null;

  /** Transform object types (before processing properties) */
  onObject?: (type: TypeInfo & { kind: TypeKind.Object }) => string | TypeInfo | null;

  /** Transform array types (before processing element) */
  onArray?: (type: TypeInfo & { kind: TypeKind.Array }) => string | TypeInfo | null;

  /** Transform union types (before processing members) */
  onUnion?: (type: TypeInfo & { kind: TypeKind.Union }) => string | TypeInfo | null;

  /** Transform intersection types (before processing members) */
  onIntersection?: (type: TypeInfo & { kind: TypeKind.Intersection }) => string | TypeInfo | null;

  /** Transform generic types */
  onGeneric?: (type: TypeInfo & { kind: TypeKind.Generic }) => string | TypeInfo | null;

  /** Transform literal types */
  onLiteral?: (type: TypeInfo & { kind: TypeKind.Literal }) => string | TypeInfo | null;

  /** Transform reference types */
  onReference?: (type: TypeInfo & { kind: TypeKind.Reference }) => string | TypeInfo | null;

  /** Transform tuple types */
  onTuple?: (type: TypeInfo & { kind: TypeKind.Tuple }) => string | TypeInfo | null;

  /** Transform any type (fallback) */
  onAny?: (type: TypeInfo) => string | TypeInfo | null;
}

/**
 * Recursively transforms a TypeInfo structure using the provided transformer
 *
 * The transformer can intercept at any level and return either:
 * - A string (final transformed type)
 * - A TypeInfo (to continue transformation)
 * - null/undefined (to use default transformation)
 *
 * @param typeInfo - The type to transform
 * @param transformer - Transformation handlers for different type kinds
 * @param options - Options for transformation (builder types, etc.)
 * @returns String representation of the transformed type
 *
 * @example
 * ```typescript
 * import { primitive } from './matchers/primitive-matcher.js';
 *
 * // Transform all string types to include a union with { value: string }
 * const result = transformTypeDeep(propertyType, {
 *   onPrimitive: (type) => {
 *     if (primitive('string').match(type)) {
 *       return 'string | { value: string }';
 *     }
 *     return null;
 *   }
 * }, { includeBuilderTypes: true });
 *
 * // For Array<string>, this produces: Array<string | { value: string }>
 * // For { a: string, b: { c: string } }, this produces:
 * // { a: string | { value: string }; b: { c: string | { value: string } } }
 * ```
 */
/**
 * Checks if a property name needs quotes in TypeScript type definitions
 * @param name - The property name to check
 * @returns True if the property name needs quotes
 */
function needsQuotes(name: string): boolean {
  // Valid TypeScript identifier: starts with letter/$/_, followed by letter/digit/$/_
  return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Formats a property name with quotes if needed
 * @param name - The property name to format
 * @returns Formatted property name
 */
function formatPropertyName(name: string): string {
  return needsQuotes(name) ? `"${name}"` : name;
}

export function transformTypeDeep(
  typeInfo: TypeInfo,
  transformer: TypeTransformer,
  options?: TransformTypeDeepOptions,
): string {
  const builderTypeName = options?.builderTypeName ?? 'FluentBuilder';
  const contextTypeName = options?.contextTypeName ?? 'BaseBuildContext';
  const includeBuilderTypes = options?.includeBuilderTypes ?? false;

  /**
   * Checks if a type name is valid for importing (not __type or unknown)
   */
  function isValidImportableTypeName(name: string | undefined): boolean {
    if (!name) return false;
    return name !== '__type' && name !== 'unknown' && name.trim() !== '';
  }

  /**
   * Checks if a type is eligible for builder generation
   */
  function isTypeBuilderEligible(type: TypeInfo): boolean {
    return (
      type.kind === TypeKind.Object &&
      hasName(type) &&
      type.name !== undefined &&
      isValidImportableTypeName(type.name)
    );
  }

  function processType(type: TypeInfo): string {
    // Try fallback transformer first if defined
    if (transformer.onAny) {
      const result = transformer.onAny(type);
      if (result !== null && result !== undefined) {
        return typeof result === 'string' ? result : processType(result);
      }
    }

    switch (type.kind) {
      case TypeKind.Primitive: {
        if (transformer.onPrimitive) {
          const result = transformer.onPrimitive(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }
        return typeInfoToString(type);
      }

      case TypeKind.Array: {
        if (transformer.onArray) {
          const result = transformer.onArray(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }

        // Recursively process element type
        if (!hasElementType(type)) {
          return 'Array<unknown>';
        }
        const elementType = processType(type.elementType);
        return `Array<${elementType}>`;
      }

      case TypeKind.Object: {
        if (transformer.onObject) {
          const result = transformer.onObject(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }

        // Named object with generics
        if (hasName(type) && type.name) {
          let result: string;
          if (hasGenericParams(type) && type.genericParams.length > 0) {
            const params = type.genericParams
              .map(p => ('name' in p && typeof p.name === 'string' ? p.name : 'unknown'))
              .join(', ');
            result = `${type.name}<${params}>`;
          } else {
            result = type.name;
          }

          // Add FluentBuilder union for eligible named types
          if (includeBuilderTypes && isTypeBuilderEligible(type)) {
            result = `${result} | ${builderTypeName}<${type.name}, ${contextTypeName}>`;
          }

          return result;
        }

        // Anonymous object - recursively process properties
        if (!hasProperties(type) || type.properties.length === 0) {
          return '{}';
        }

        const props = type.properties
          .map(prop => {
            const optional = prop.optional ? '?' : '';
            const readonly = prop.readonly ? 'readonly ' : '';
            let propType = processType(prop.type);

            // Add FluentBuilder union for named object types if enabled and not already added
            if (includeBuilderTypes && isTypeBuilderEligible(prop.type)) {
              const typeName = (prop.type as { name?: string }).name;
              const builderUnion = `${builderTypeName}<${typeName}, ${contextTypeName}>`;
              // Only add if not already present (avoid duplicates)
              if (typeName && !propType.includes(builderUnion)) {
                propType = `${propType} | ${builderUnion}`;
              }
            }

            return `${readonly}${formatPropertyName(prop.name)}${optional}: ${propType}`;
          })
          .join('; ');

        return `{ ${props} }`;
      }

      case TypeKind.Union: {
        if (transformer.onUnion) {
          const result = transformer.onUnion(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }

        if (!hasUnionTypes(type) || type.unionTypes.length === 0) {
          return 'never';
        }

        // Recursively process union members
        const members = type.unionTypes.map(t => processType(t));
        return members.join(' | ');
      }

      case TypeKind.Intersection: {
        if (transformer.onIntersection) {
          const result = transformer.onIntersection(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }

        const types = getIntersectionTypes(type);
        if (!types || types.length === 0) {
          return 'unknown';
        }

        // Recursively process intersection members
        const members = types.map(t => processType(t));
        return members.join(' & ');
      }

      case TypeKind.Generic: {
        if (transformer.onGeneric) {
          const result = transformer.onGeneric(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }
        return typeInfoToString(type);
      }

      case TypeKind.Literal: {
        if (transformer.onLiteral) {
          const result = transformer.onLiteral(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }
        return typeInfoToString(type);
      }

      case TypeKind.Reference: {
        if (transformer.onReference) {
          const result = transformer.onReference(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }
        return typeInfoToString(type);
      }

      case TypeKind.Tuple: {
        if (transformer.onTuple) {
          const result = transformer.onTuple(type);
          if (result !== null && result !== undefined) {
            return typeof result === 'string' ? result : processType(result);
          }
        }

        if ('elements' in type && Array.isArray(type.elements)) {
          const elements = type.elements.map(e => processType(e)).join(', ');
          return `[${elements}]`;
        }
        return '[]';
      }

      default:
        return typeInfoToString(type);
    }
  }

  return processType(typeInfo);
}
