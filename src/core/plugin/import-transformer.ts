import type {
  StructuredImport,
  StructuredNamedImport,
  CreateImportOptions,
  RelativeToMonorepoMapping,
  ImportTransformUtils,
} from './plugin-types.js';
import { ImportParsingUtils } from '../utils/import-parser-utils.js';

interface BaseImport {
  readonly source: string;
  readonly namedImports: readonly StructuredNamedImport[];
  readonly isTypeOnly: boolean;
  readonly isSideEffect: boolean;
}

function buildStructuredImport(
  base: BaseImport,
  options: { defaultImport?: string; namespaceImport?: string },
): StructuredImport {
  if (options.defaultImport && options.namespaceImport) {
    return {
      ...base,
      defaultImport: options.defaultImport,
      namespaceImport: options.namespaceImport,
    };
  }

  if (options.defaultImport) {
    return {
      ...base,
      defaultImport: options.defaultImport,
    };
  }

  if (options.namespaceImport) {
    return {
      ...base,
      namespaceImport: options.namespaceImport,
    };
  }

  return base;
}

/**
 * Parses import statements into structured objects for easy manipulation.
 *
 * This class provides methods to convert import statement strings into
 * structured data that can be programmatically analyzed and transformed.
 */
export class ImportParser {
  /**
   * Parses a single import statement string into a structured format.
   *
   * @param importStatement - The import statement to parse (e.g., `import { Foo } from "./module.js";`)
   * @returns A structured representation of the import
   * @throws {Error} If the import statement is invalid
   *
   * @example
   * ```typescript
   * const result = ImportParser.parseImport('import { Foo, Bar } from "./module.js";');
   * // result.namedImports = [{ name: 'Foo' }, { name: 'Bar' }]
   * // result.source = './module.js'
   * ```
   */
  static parseImport(importStatement: string): StructuredImport {
    return ImportParsingUtils.parseImportToStructured(importStatement);
  }

  /**
   * Parses multiple import statements.
   *
   * @param importStatements - Array of import statement strings to parse
   * @returns Array of structured imports
   * @throws {Error} If any import statement is invalid
   */
  static parseImports(importStatements: readonly string[]): StructuredImport[] {
    return ImportParsingUtils.parseImportsToStructured(importStatements);
  }
}

/**
 * Serializes structured import objects back into import statement strings.
 *
 * This class provides the inverse operation of ImportParser, converting
 * structured import data back into valid import statement syntax.
 */
export class ImportSerializer {
  /**
   * Serializes a structured import back into an import statement string.
   *
   * @param structuredImport - The structured import to serialize
   * @returns A valid import statement string
   * @throws {Error} If the structured import has no imports specified
   *
   * @example
   * ```typescript
   * const structured = {
   *   source: 'react',
   *   namedImports: [{ name: 'useState' }],
   *   defaultImport: 'React',
   *   isTypeOnly: false,
   *   isSideEffect: false
   * };
   * const result = ImportSerializer.serializeImport(structured);
   * // result = 'import React, { useState } from "react";'
   * ```
   */
  static serializeImport(structuredImport: StructuredImport): string {
    const { source, namedImports, defaultImport, namespaceImport, isTypeOnly, isSideEffect } =
      structuredImport;

    // Handle side-effect imports
    if (isSideEffect) {
      return `import "${source}";`;
    }

    // Handle namespace imports
    if (namespaceImport) {
      const typePrefix = isTypeOnly ? 'type ' : '';
      return `import ${typePrefix}* as ${namespaceImport} from "${source}";`;
    }

    // Build import parts
    const parts: string[] = [];

    // Add default import
    if (defaultImport) {
      parts.push(defaultImport);
    }

    // Add named imports
    if (namedImports.length > 0) {
      const namedParts = namedImports.map(ni => {
        let part = '';
        if (ni.isTypeOnly && !isTypeOnly) {
          part += 'type ';
        }
        part += ni.name;
        if (ni.alias) {
          part += ` as ${ni.alias}`;
        }
        return part;
      });

      parts.push(`{ ${namedParts.join(', ')} }`);
    }

    if (parts.length === 0) {
      throw new Error('Invalid structured import: no imports specified');
    }

    const typePrefix = isTypeOnly ? 'type ' : '';
    return `import ${typePrefix}${parts.join(', ')} from "${source}";`;
  }

  /**
   * Serializes multiple structured imports.
   *
   * @param structuredImports - Array of structured imports to serialize
   * @returns Array of import statement strings
   */
  static serializeImports(structuredImports: readonly StructuredImport[]): string[] {
    return structuredImports.map(imp => this.serializeImport(imp));
  }
}

/**
 * Provides utility methods for transforming and manipulating structured imports.
 *
 * This class implements various transformation operations including:
 * - Transforming relative paths to monorepo packages
 * - Creating new imports programmatically
 * - Merging duplicate imports
 * - Filtering imports by criteria
 * - Replacing import sources
 */
export class ImportTransformUtilsImpl implements ImportTransformUtils {
  /**
   * Transforms relative import paths to monorepo package imports.
   *
   * Only transforms imports that start with './' or '../'. Uses the provided
   * path mappings to replace relative paths with monorepo package names.
   *
   * @param imports - The imports to transform
   * @param mapping - Configuration mapping relative paths to package names
   * @returns Transformed imports with updated sources
   *
   * @example
   * ```typescript
   * const imports = [{ source: '../../../types/User.js', ... }];
   * const mapping = {
   *   pathMappings: new Map([['../../../types/', '@my-org/types/']])
   * };
   * const result = utils.transformRelativeToMonorepo(imports, mapping);
   * // result[0].source = '@my-org/types/User.js'
   * ```
   */
  transformRelativeToMonorepo(
    imports: readonly StructuredImport[],
    mapping: RelativeToMonorepoMapping,
  ): readonly StructuredImport[] {
    return imports.map(imp => {
      // Skip if not a relative import
      if (!imp.source.startsWith('./') && !imp.source.startsWith('../')) {
        return imp;
      }

      // Find matching mapping
      for (const rule of mapping.pathMappings) {
        if (rule.isRegex) {
          // RegExp pattern
          const regex = new RegExp(rule.pattern);
          if (regex.test(imp.source)) {
            return {
              ...imp,
              source: imp.source.replace(regex, rule.replacement),
            };
          }
        } else {
          // String pattern
          if (imp.source.includes(rule.pattern)) {
            return {
              ...imp,
              source: imp.source.replace(rule.pattern, rule.replacement),
            };
          }
        }
      }

      return imp;
    });
  }

  /**
   * Creates a new structured import programmatically.
   *
   * @param source - The module path or package name
   * @param options - Configuration options for the import
   * @returns A new structured import
   *
   * @example
   * ```typescript
   * const imp = utils.createImport('react', {
   *   defaultImport: 'React',
   *   namedImports: ['useState', { name: 'FC', isTypeOnly: true }]
   * });
   * ```
   */
  createImport(source: string, options: CreateImportOptions = {}): StructuredImport {
    const namedImports: StructuredNamedImport[] = [];

    if (options.namedImports) {
      for (const namedImport of options.namedImports) {
        if (typeof namedImport === 'string') {
          namedImports.push({ name: namedImport });
        } else {
          namedImports.push(namedImport);
        }
      }
    }

    const base: BaseImport = {
      source,
      namedImports,
      isTypeOnly: options.isTypeOnly ?? false,
      isSideEffect: options.isSideEffect ?? false,
    };

    const importOptions: { defaultImport?: string; namespaceImport?: string } = {};
    if (options.defaultImport !== undefined) {
      importOptions.defaultImport = options.defaultImport;
    }
    if (options.namespaceImport !== undefined) {
      importOptions.namespaceImport = options.namespaceImport;
    }

    return buildStructuredImport(base, importOptions);
  }

  /**
   * Normalizes a source path by ensuring relative imports have .js extension.
   * This prevents issues where "../b" and "../b.js" are treated as different sources.
   *
   * @param source - The import source to normalize
   * @returns Normalized source with .js extension for relative imports
   */
  private normalizeImportSource(source: string): string {
    // Only normalize relative imports (starting with . or ..)
    if (!source.startsWith('.')) {
      return source;
    }

    // If already has .js extension, return as-is
    if (source.endsWith('.js')) {
      return source;
    }

    // If has .ts extension (shouldn't happen in imports but be safe), replace it
    if (source.endsWith('.ts')) {
      return source.replace(/\.ts$/, '.js');
    }

    // Add .js extension
    return `${source}.js`;
  }

  /**
   * Merges imports from the same source into single import statements.
   *
   * Combines named imports, preserves default and namespace imports from the first
   * occurrence, and handles type-only imports correctly. An import is only type-only
   * if all merged imports are type-only. Side effects are preserved if any import
   * has side effects.
   *
   * @param imports - The imports to merge
   * @returns Merged imports with deduplicated sources
   *
   * @example
   * ```typescript
   * const imports = [
   *   { source: './module.js', namedImports: [{ name: 'A' }], ... },
   *   { source: './module.js', namedImports: [{ name: 'B' }], ... }
   * ];
   * const result = utils.mergeImports(imports);
   * // result = [{ source: './module.js', namedImports: [{ name: 'A' }, { name: 'B' }], ... }]
   * ```
   */
  mergeImports(imports: readonly StructuredImport[]): readonly StructuredImport[] {
    const merged = new Map<string, StructuredImport>();

    for (const imp of imports) {
      // Normalize the source to ensure consistent .js extensions
      const normalizedSource = this.normalizeImportSource(imp.source);
      const normalizedImp =
        imp.source !== normalizedSource ? { ...imp, source: normalizedSource } : imp;

      const existing = merged.get(normalizedSource);

      if (!existing) {
        merged.set(normalizedSource, { ...normalizedImp });
        continue;
      }

      // Merge imports from same source
      const mergedNamedImports = [...existing.namedImports];
      const existingNames = new Set(
        existing.namedImports.map(ni => `${ni.name}${ni.alias ? `:${ni.alias}` : ''}`),
      );

      for (const namedImport of normalizedImp.namedImports) {
        const key = `${namedImport.name}${namedImport.alias ? `:${namedImport.alias}` : ''}`;
        if (!existingNames.has(key)) {
          mergedNamedImports.push(namedImport);
          existingNames.add(key);
        }
      }

      const base: BaseImport = {
        source: normalizedSource,
        namedImports: mergedNamedImports,
        isTypeOnly: existing.isTypeOnly && normalizedImp.isTypeOnly,
        isSideEffect: existing.isSideEffect || normalizedImp.isSideEffect,
      };

      const importOptions: { defaultImport?: string; namespaceImport?: string } = {};
      const defaultImport = existing.defaultImport || normalizedImp.defaultImport;
      const namespaceImport = existing.namespaceImport || normalizedImp.namespaceImport;

      if (defaultImport !== undefined) {
        importOptions.defaultImport = defaultImport;
      }
      if (namespaceImport !== undefined) {
        importOptions.namespaceImport = namespaceImport;
      }

      const result = buildStructuredImport(base, importOptions);

      merged.set(normalizedSource, result);
    }

    return Array.from(merged.values());
  }

  /**
   * Filters imports based on a predicate function.
   *
   * @param imports - The imports to filter
   * @param predicate - Function that returns true for imports to keep
   * @returns Filtered array of imports
   */
  filterImports(
    imports: readonly StructuredImport[],
    predicate: (imp: StructuredImport) => boolean,
  ): readonly StructuredImport[] {
    return imports.filter(predicate);
  }

  /**
   * Replaces import sources using string or RegExp patterns.
   *
   * @param imports - The imports to transform
   * @param from - String or RegExp pattern to match in the source
   * @param to - Replacement string for matched patterns
   * @returns Imports with replaced sources
   */
  replaceSource(
    imports: readonly StructuredImport[],
    options: { from: string | RegExp; to: string },
  ): readonly StructuredImport[] {
    return imports.map(imp => ({
      ...imp,
      source: imp.source.replace(options.from, options.to),
    }));
  }
}
