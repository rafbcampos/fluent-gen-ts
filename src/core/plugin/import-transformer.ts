import type {
  StructuredImport,
  StructuredNamedImport,
  CreateImportOptions,
  RelativeToMonorepoMapping,
  ImportTransformUtils,
} from './plugin-types.js';
import { ImportParsingUtils } from '../utils/import-parser-utils.js';

/**
 * Parses import statements into structured objects
 */
export class ImportParser {
  /**
   * Parse a single import statement string into a StructuredImport
   */
  static parseImport(importStatement: string): StructuredImport {
    return ImportParsingUtils.parseImportToStructured(importStatement);
  }

  /**
   * Parse multiple import statements
   */
  static parseImports(importStatements: readonly string[]): StructuredImport[] {
    return ImportParsingUtils.parseImportsToStructured(importStatements);
  }
}

/**
 * Serializes structured imports back to import statements
 */
export class ImportSerializer {
  /**
   * Serialize a StructuredImport back to an import statement string
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
   * Serialize multiple structured imports
   */
  static serializeImports(structuredImports: readonly StructuredImport[]): string[] {
    return structuredImports.map(imp => this.serializeImport(imp));
  }
}

/**
 * Implementation of ImportTransformUtils
 */
export class ImportTransformUtilsImpl implements ImportTransformUtils {
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
      for (const [pattern, packageName] of mapping.pathMappings) {
        if (typeof pattern === 'string') {
          if (imp.source.includes(pattern)) {
            return {
              ...imp,
              source: imp.source.replace(pattern, packageName),
            };
          }
        } else {
          // RegExp pattern
          if (pattern.test(imp.source)) {
            return {
              ...imp,
              source: imp.source.replace(pattern, packageName),
            };
          }
        }
      }

      return imp;
    });
  }

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

    const baseResult = {
      source,
      namedImports,
      isTypeOnly: options.isTypeOnly ?? false,
      isSideEffect: options.isSideEffect ?? false,
    };

    // Conditionally build result with optional properties
    if (options.defaultImport && options.namespaceImport) {
      return {
        ...baseResult,
        defaultImport: options.defaultImport,
        namespaceImport: options.namespaceImport,
      };
    } else if (options.defaultImport) {
      return {
        ...baseResult,
        defaultImport: options.defaultImport,
      };
    } else if (options.namespaceImport) {
      return {
        ...baseResult,
        namespaceImport: options.namespaceImport,
      };
    }

    return baseResult;
  }

  mergeImports(imports: readonly StructuredImport[]): readonly StructuredImport[] {
    const merged = new Map<string, StructuredImport>();

    for (const imp of imports) {
      const existing = merged.get(imp.source);

      if (!existing) {
        merged.set(imp.source, { ...imp });
        continue;
      }

      // Merge imports from same source
      const mergedNamedImports = [...existing.namedImports];
      const existingNames = new Set(
        existing.namedImports.map(ni => `${ni.name}${ni.alias ? `:${ni.alias}` : ''}`),
      );

      for (const namedImport of imp.namedImports) {
        const key = `${namedImport.name}${namedImport.alias ? `:${namedImport.alias}` : ''}`;
        if (!existingNames.has(key)) {
          mergedNamedImports.push(namedImport);
          existingNames.add(key);
        }
      }

      const baseResult = {
        source: imp.source,
        namedImports: mergedNamedImports,
        isTypeOnly: existing.isTypeOnly && imp.isTypeOnly,
        isSideEffect: existing.isSideEffect || imp.isSideEffect,
      };

      const defaultImport = existing.defaultImport || imp.defaultImport;
      const namespaceImport = existing.namespaceImport || imp.namespaceImport;

      // Conditionally build result with optional properties
      if (defaultImport && namespaceImport) {
        merged.set(imp.source, {
          ...baseResult,
          defaultImport,
          namespaceImport,
        });
      } else if (defaultImport) {
        merged.set(imp.source, {
          ...baseResult,
          defaultImport,
        });
      } else if (namespaceImport) {
        merged.set(imp.source, {
          ...baseResult,
          namespaceImport,
        });
      } else {
        merged.set(imp.source, baseResult);
      }
    }

    return Array.from(merged.values());
  }

  filterImports(
    imports: readonly StructuredImport[],
    predicate: (imp: StructuredImport) => boolean,
  ): readonly StructuredImport[] {
    return imports.filter(predicate);
  }

  replaceSource(
    imports: readonly StructuredImport[],
    from: string | RegExp,
    to: string,
  ): readonly StructuredImport[] {
    return imports.map(imp => ({
      ...imp,
      source: imp.source.replace(from, to),
    }));
  }
}
