/**
 * Type definitions for the generator module
 * Provides type-safe interfaces for code generation
 */

import type { IndexSignature } from '../core/types.js';

/**
 * Type guard to check if a value has an index signature structure
 */
export function isIndexSignature(value: unknown): value is IndexSignature {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.keyType === 'string' &&
    (obj.keyType === 'string' || obj.keyType === 'number' || obj.keyType === 'symbol') &&
    obj.valueType !== undefined &&
    obj.valueType !== null &&
    typeof obj.valueType === 'object' &&
    'kind' in obj.valueType
  );
}

/**
 * Classification of TypeScript primitive types
 * Used to avoid hardcoded string comparisons
 */
export enum PrimitiveType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  BigInt = 'bigint',
  Symbol = 'symbol',
  Object = 'object',
  Undefined = 'undefined',
  Null = 'null',
  Any = 'any',
  Unknown = 'unknown',
  Never = 'never',
  Void = 'void',
}

/**
 * Type guard to check if a type name is a primitive
 */
export function isPrimitiveTypeName(name: string): name is PrimitiveType {
  return Object.values(PrimitiveType).includes(name as PrimitiveType);
}

/**
 * Type guard to check if a type name is valid and importable
 * Excludes internal TypeScript types and primitives
 */
export function isValidImportableTypeName(name: string | undefined): name is string {
  if (typeof name !== 'string' || name.length === 0) {
    return false;
  }

  // Exclude primitives
  if (isPrimitiveTypeName(name)) {
    return false;
  }

  // Exclude internal TypeScript type names
  if (name.startsWith('__')) {
    return false;
  }

  return true;
}

/**
 * Configuration for generating default values
 */
export interface DefaultValueConfig {
  /** Whether to generate default values */
  readonly useDefaults: boolean;
  /** Custom default value generators by type kind */
  readonly customDefaults?: Map<string, () => unknown>;
}

/**
 * Context for method generation
 */
export interface MethodGenerationContext {
  /** The name of the method */
  readonly methodName: string;
  /** The type of the parameter */
  readonly paramType: string;
  /** The return type */
  readonly returnType: string;
  /** Optional JSDoc comment */
  readonly jsDoc?: string;
}
