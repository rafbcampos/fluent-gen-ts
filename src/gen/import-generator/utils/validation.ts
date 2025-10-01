import { isValidImportableTypeName } from '../../types.js';
import type { ImportValidationResult } from '../types.js';
import { ok, err } from '../../../core/result.js';

const MAX_IMPORT_PATH_LENGTH = 1000;
const MAX_IMPORT_STATEMENTS_LENGTH = 8000;

/**
 * Validates an import path string for safety and correctness.
 *
 * @param importPath - The import path to validate
 * @returns A Result containing true if valid, or an error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateImportPath('./types.js');
 * if (result.ok) {
 *   console.log('Valid import path');
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export const validateImportPath = (importPath: string): ImportValidationResult => {
  if (!importPath || typeof importPath !== 'string') {
    return err('Import path must be a non-empty string');
  }

  if (importPath.trim() === '') {
    return err('Import path cannot be empty or whitespace-only');
  }

  if (importPath.length > MAX_IMPORT_PATH_LENGTH) {
    return err('Import path exceeds maximum allowed length');
  }

  return ok(true);
};

/**
 * Validates a type name according to TypeScript conventions.
 *
 * Checks if the type name is a valid, importable TypeScript type name that:
 * - Is a non-empty string
 * - Follows valid identifier rules
 * - Starts with uppercase letter (PascalCase convention)
 * - Is not a primitive type
 *
 * @param typeName - The type name to validate
 * @returns True if the type name is valid and importable, false otherwise
 *
 * @example
 * ```typescript
 * validateTypeName('UserProfile'); // true
 * validateTypeName('userProfile'); // false (not PascalCase)
 * validateTypeName('string'); // false (primitive type)
 * ```
 */
export const validateTypeName = (typeName: string): boolean => {
  return (
    typeof typeName === 'string' && typeName.trim() !== '' && isValidImportableTypeName(typeName)
  );
};

/**
 * Checks if a type name refers to a global type constructor available in the global scope.
 *
 * This function only checks for own properties of globalThis (not inherited ones)
 * and verifies that the property is a function, indicating it's a constructor.
 *
 * @param typeName - The type name to check
 * @returns True if the type is a global constructor function, false otherwise
 *
 * @example
 * ```typescript
 * isGlobalType('Array'); // true
 * isGlobalType('Date'); // true
 * isGlobalType('UserProfile'); // false
 * isGlobalType('constructor'); // false (inherited, not own property)
 * ```
 */
export const isGlobalType = (typeName: string): boolean => {
  if (typeof typeName !== 'string' || typeName.trim() === '') {
    return false;
  }

  try {
    // Check for own properties only (not inherited)
    if (!Object.prototype.hasOwnProperty.call(globalThis, typeName)) {
      return false;
    }

    // Type-safe property access using bracket notation
    const globalProperty = globalThis[typeName as keyof typeof globalThis];
    return typeof globalProperty === 'function';
  } catch {
    return false;
  }
};

/**
 * TypeScript utility types that are built-in and should not be imported.
 * These types exist only at compile time and are part of TypeScript's type system.
 */
const TYPESCRIPT_UTILITY_TYPES = new Set([
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'ConstructorParameters',
  'InstanceType',
  'Awaited',
  'ThisParameterType',
  'OmitThisParameter',
  'ThisType',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
] as const);

/**
 * Checks if a type name is a TypeScript built-in utility type.
 *
 * TypeScript utility types (like Partial, Pick, Record, etc.) are part of
 * TypeScript's type system and should never be imported. They exist only at
 * compile time and are automatically available in all TypeScript code.
 *
 * @param typeName - The type name to check
 * @returns True if the type is a TypeScript utility type, false otherwise
 *
 * @example
 * ```typescript
 * isTypeScriptUtilityType('Partial'); // true
 * isTypeScriptUtilityType('Pick'); // true
 * isTypeScriptUtilityType('UserProfile'); // false
 * ```
 */
export const isTypeScriptUtilityType = (typeName: string): boolean => {
  if (typeof typeName !== 'string' || typeName.trim() === '') {
    return false;
  }

  return TYPESCRIPT_UTILITY_TYPES.has(typeName as any);
};

/**
 * Checks if a type should not be imported because it's either a global runtime type
 * or a TypeScript utility type.
 *
 * @param typeName - The type name to check
 * @returns True if the type should not be imported, false otherwise
 *
 * @example
 * ```typescript
 * isNonImportableType('Array'); // true (global runtime type)
 * isNonImportableType('Partial'); // true (TypeScript utility type)
 * isNonImportableType('UserProfile'); // false (importable custom type)
 * ```
 */
export const isNonImportableType = (typeName: string): boolean => {
  return isGlobalType(typeName) || isTypeScriptUtilityType(typeName);
};

/**
 * Validates import statements string for safe processing.
 *
 * Ensures the import statements string is valid and within safe length limits
 * to prevent potential memory issues during processing.
 *
 * @param importStatements - The import statements string to validate
 * @returns A Result containing true if valid, or an error message if invalid
 *
 * @example
 * ```typescript
 * const imports = `import { User } from './types.js';`;
 * const result = validateImportStatements(imports);
 * if (result.ok) {
 *   // Safe to process
 * }
 * ```
 */
export const validateImportStatements = (importStatements: string): ImportValidationResult => {
  if (typeof importStatements !== 'string') {
    return err('Import statements must be a string');
  }

  if (importStatements.length > MAX_IMPORT_STATEMENTS_LENGTH) {
    return err('Import statements string too long for safe processing');
  }

  return ok(true);
};

/**
 * Sanitizes import statements by truncating if they exceed safe length limits.
 *
 * If the import statements string is longer than the maximum allowed length,
 * it will be truncated to prevent memory issues. A warning is logged when truncation occurs.
 *
 * @param importStatements - The import statements string to sanitize
 * @returns The sanitized import statements string (truncated if necessary)
 *
 * @example
 * ```typescript
 * const longImports = 'very long import string...';
 * const safe = sanitizeImportStatements(longImports);
 * // Returns truncated version if too long
 * ```
 */
export const sanitizeImportStatements = (importStatements: string): string => {
  if (importStatements.length > MAX_IMPORT_STATEMENTS_LENGTH) {
    console.warn('Import statements string too long, truncating for safety');
    return importStatements.substring(0, MAX_IMPORT_STATEMENTS_LENGTH);
  }
  return importStatements;
};
