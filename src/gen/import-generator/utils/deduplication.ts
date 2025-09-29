import { validateTypeName } from './validation.js';
import { ImportParsingUtils } from '../../../core/utils/import-parser-utils.js';

/**
 * Categories for organizing import types during conflict resolution
 */
export interface ImportCategories {
  /** Type names defined locally in the file */
  localTypes: Set<string>;
  /** Map of source files to their imported type names */
  relativeImports: Map<string, Set<string>>;
  /** Map of type names to their external module sources */
  externalTypes: Map<string, string>;
}

/**
 * Removes duplicate import statements based on imported names.
 * Keeps the first occurrence of each unique import name.
 *
 * @param imports - Array of import statements as strings
 * @returns Array of deduplicated import statements
 *
 * @example
 * ```typescript
 * const imports = [
 *   'import type { User } from "./types";',
 *   'import type { User } from "./other";',  // Duplicate User
 *   'import { api } from "./api";'
 * ];
 * const result = deduplicateImports(imports);
 * // Result: ['import type { User } from "./types";', 'import { api } from "./api";']
 * ```
 */
export const deduplicateImports = (imports: string[]): string[] => {
  if (!Array.isArray(imports)) {
    return [];
  }

  const seen = new Set<string>();
  const typeToImportMap = new Map<string, string>();
  const deduplicated: string[] = [];

  for (const imp of imports) {
    // Skip non-string entries
    if (typeof imp !== 'string') {
      continue;
    }

    const normalized = imp.trim();
    // Skip empty strings
    if (!normalized) {
      continue;
    }

    // Skip exact duplicates
    if (seen.has(normalized)) {
      continue;
    }

    // Check for semantic duplicates (same imported names)
    const importedNames = ImportParsingUtils.extractAllImportedNames(normalized);
    const hasConflict = importedNames.some(name => typeToImportMap.has(name));

    if (hasConflict) {
      continue;
    }

    // Add this import and track its names
    seen.add(normalized);
    importedNames.forEach(name => typeToImportMap.set(name, normalized));
    deduplicated.push(imp);
  }

  return deduplicated;
};

/**
 * Extracts type names from an import statement.
 * Identifies types by explicit 'type' keyword or capitalized names.
 *
 * @param importStatement - A single import statement string
 * @returns Array of type names found in the import
 *
 * @example
 * ```typescript
 * extractImportedTypes('import type { User, Profile } from "./types";');
 * // Returns: ['User', 'Profile']
 *
 * extractImportedTypes('import { useState, type FC } from "react";');
 * // Returns: ['FC']
 * ```
 */
export const extractImportedTypes = (importStatement: string): string[] => {
  return ImportParsingUtils.extractImportedTypes(importStatement, validateTypeName);
};

/**
 * Extracts module paths from import statements that contain type imports.
 * Only returns modules that have at least one type import (explicit or inferred).
 *
 * @param importStatements - String containing multiple import statements
 * @returns Set of module paths that contain type imports
 *
 * @example
 * ```typescript
 * const imports = `
 *   import type { User } from "./types";
 *   import { api } from "./api";
 *   import { Component } from "react";
 * `;
 * const modules = extractModulesFromNamedImports(imports);
 * // Returns: Set { './types', 'react' }
 * ```
 */
export const extractModulesFromNamedImports = (importStatements: string): Set<string> => {
  const modules = new Set<string>();

  // Truncate overly long inputs for safety
  const maxLength = 10000;
  let processedStatements = importStatements;
  if (importStatements.length > maxLength) {
    console.warn('Import statements string too long, truncating for safety');
    processedStatements = importStatements.substring(0, maxLength);
  }

  // Match type-only imports
  const namedTypeImportRegex = /import\s+type\s+\{\s*[^}]+\s*\}\s+from\s+["']([^"']+)["']/gm;
  // Match mixed imports that may contain types
  const mixedImportRegex = /import\s+(?:\w+\s*,\s*)?\{[^}]+\}\s+from\s+["']([^"']+)["']/gm;

  let match;
  // Process type-only imports
  while ((match = namedTypeImportRegex.exec(processedStatements)) !== null) {
    if (match[1]) {
      modules.add(match[1]);
    }
  }

  // Process mixed imports to find ones with types
  while ((match = mixedImportRegex.exec(processedStatements)) !== null) {
    if (match[1]) {
      const braceStart = match[0].indexOf('{');
      const braceEnd = match[0].indexOf('}');
      if (braceStart !== -1 && braceEnd !== -1) {
        const importContent = match[0].substring(braceStart + 1, braceEnd);

        // Check for explicit type imports or capitalized identifiers (likely types)
        if (/\btype\s+\w+/.test(importContent) || /\b[A-Z]\w*\b/.test(importContent)) {
          modules.add(match[1]);
        }
      }
    }
  }

  return modules;
};

/**
 * Resolves import conflicts by prioritizing external types.
 * Mutates the input categories by removing conflicting types from local and relative imports.
 * External types are considered authoritative and preserved.
 *
 * @param categories - Import categories to resolve conflicts in
 *
 * @example
 * ```typescript
 * const categories = {
 *   localTypes: new Set(['User', 'Profile']),
 *   relativeImports: new Map([['./types', new Set(['User'])]]),
 *   externalTypes: new Map([['User', '@types/user']])
 * };
 * resolveImportConflicts(categories);
 * // After: localTypes and relativeImports no longer contain 'User'
 * ```
 */
export const resolveImportConflicts = (categories: ImportCategories): void => {
  const externalTypeNames = new Set(categories.externalTypes.keys());

  // Remove external types from local types
  externalTypeNames.forEach(typeName => {
    categories.localTypes.delete(typeName);
  });

  // Remove external types from relative imports
  for (const [sourceFile, types] of categories.relativeImports) {
    // Remove conflicting types in place
    externalTypeNames.forEach(typeName => {
      types.delete(typeName);
    });

    // Remove empty entries
    if (types.size === 0) {
      categories.relativeImports.delete(sourceFile);
    }
  }
};
