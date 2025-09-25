import { isValidImportableTypeName } from '../../types.js';
import type { ImportValidationResult } from '../types.js';
import { ok, err } from '../../../core/result.js';

export const validateImportPath = (importPath: string): ImportValidationResult => {
  if (!importPath || typeof importPath !== 'string') {
    return err('Import path must be a non-empty string');
  }

  if (importPath.trim() === '') {
    return err('Import path cannot be empty or whitespace-only');
  }

  if (importPath.length > 1000) {
    return err('Import path exceeds maximum allowed length');
  }

  return ok(true);
};

export const validateTypeName = (typeName: string): boolean => {
  return (
    typeof typeName === 'string' && typeName.trim() !== '' && isValidImportableTypeName(typeName)
  );
};

export const isGlobalType = (typeName: string): boolean => {
  if (typeof typeName !== 'string' || typeName.trim() === '') {
    return false;
  }

  try {
    return (
      Object.prototype.hasOwnProperty.call(globalThis, typeName) &&
      typeof (globalThis as Record<string, unknown>)[typeName] === 'function'
    );
  } catch {
    return false;
  }
};

export const validateImportStatements = (importStatements: string): ImportValidationResult => {
  if (typeof importStatements !== 'string') {
    return err('Import statements must be a string');
  }

  if (importStatements.length > 8000) {
    return err('Import statements string too long for safe processing');
  }

  return ok(true);
};

export const sanitizeImportStatements = (importStatements: string): string => {
  if (importStatements.length > 8000) {
    console.warn('Import statements string too long, truncating for safety');
    return importStatements.substring(0, 8000);
  }
  return importStatements;
};
