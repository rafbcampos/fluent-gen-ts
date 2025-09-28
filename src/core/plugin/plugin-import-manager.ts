import type { Import, InternalImport, ExternalImport, PluginImports } from './plugin-types.js';

/**
 * Fluent API for managing plugin imports
 * Provides a type-safe way to declare import requirements without string manipulation
 */
export class ImportManager {
  private imports: Import[] = [];

  private normalizeImports(imports: string | string[]): string[] {
    return Array.isArray(imports) ? imports : [imports];
  }

  private buildImportOptions(options?: {
    typeOnly?: boolean;
    isDefault?: boolean;
    defaultName?: string;
  }): {
    isTypeOnly?: boolean;
    isDefault?: boolean;
    defaultName?: string;
  } {
    const result: {
      isTypeOnly?: boolean;
      isDefault?: boolean;
      defaultName?: string;
    } = {};

    if (options?.typeOnly !== undefined) {
      result.isTypeOnly = options.typeOnly;
    }
    if (options?.isDefault !== undefined) {
      result.isDefault = options.isDefault;
    }
    if (options?.defaultName !== undefined) {
      result.defaultName = options.defaultName;
    }

    return result;
  }

  /**
   * Add an internal project import
   * @param path - Relative path to the file
   * @param imports - Named imports from the file
   * @param options - Import options
   */
  addInternal(
    path: string,
    imports: string | string[],
    options?: {
      typeOnly?: boolean;
      isDefault?: boolean;
      defaultName?: string;
    },
  ): this {
    const importsList = this.normalizeImports(imports);

    const internalImport: InternalImport = {
      kind: 'internal',
      path,
      imports: importsList,
      ...this.buildImportOptions(options),
    };

    this.imports.push(internalImport);
    return this;
  }

  /**
   * Add an external package import
   * @param packageName - Name of the npm package
   * @param imports - Named imports from the package
   * @param options - Import options
   */
  addExternal(
    packageName: string,
    imports: string | string[],
    options?: {
      typeOnly?: boolean;
      isDefault?: boolean;
      defaultName?: string;
    },
  ): this {
    const importsList = this.normalizeImports(imports);

    const externalImport: ExternalImport = {
      kind: 'external',
      package: packageName,
      imports: importsList,
      ...this.buildImportOptions(options),
    };

    this.imports.push(externalImport);
    return this;
  }

  /**
   * Add a default import from an internal file
   * @param path - Relative path to the file
   * @param defaultName - Name for the default import
   */
  addInternalDefault(path: string, defaultName: string): this {
    return this.addInternal(path, [], {
      isDefault: true,
      defaultName,
    });
  }

  /**
   * Add a default import from an external package
   * @param packageName - Name of the npm package
   * @param defaultName - Name for the default import
   */
  addExternalDefault(packageName: string, defaultName: string): this {
    return this.addExternal(packageName, [], {
      isDefault: true,
      defaultName,
    });
  }

  /**
   * Add type-only imports from an internal file
   * @param path - Relative path to the file
   * @param types - Type names to import
   */
  addInternalTypes(path: string, types: string | string[]): this {
    return this.addInternal(path, types, { typeOnly: true });
  }

  /**
   * Add type-only imports from an external package
   * @param packageName - Name of the npm package
   * @param types - Type names to import
   */
  addExternalTypes(packageName: string, types: string | string[]): this {
    return this.addExternal(packageName, types, { typeOnly: true });
  }

  /**
   * Merge imports from another ImportManager into this one
   * @param other - Another ImportManager instance to merge from
   * @returns This ImportManager for chaining
   */
  merge(other: ImportManager): this {
    this.imports.push(...other.getImports());
    return this;
  }

  getImports(): readonly Import[] {
    return this.imports;
  }

  /**
   * Build the final plugin imports configuration
   * @returns PluginImports object containing all configured imports
   */
  build(): PluginImports {
    return {
      imports: this.imports,
    };
  }

  /**
   * Convert imports to TypeScript/JavaScript import statements.
   * Internal imports are listed first, followed by external imports.
   * @returns Array of import statement strings ready for code generation
   */
  toImportStatements(): string[] {
    const { internal, external } = this.getGroupedImports();

    const internalStatements = this.importsToStatements(internal);
    const externalStatements = this.importsToStatements(external);

    return [...internalStatements, ...externalStatements];
  }

  private importsToStatements(imports: readonly Import[]): string[] {
    const statements: string[] = [];
    for (const imp of imports) {
      const statement = this.importToStatement(imp);
      if (statement) {
        statements.push(statement);
      }
    }
    return statements;
  }

  /**
   * Convert a single import to an import statement
   */
  private importToStatement(imp: Import): string | null {
    const typePrefix = imp.isTypeOnly ? 'type ' : '';
    const from = imp.kind === 'internal' ? imp.path : imp.package;

    if (imp.isDefault && imp.defaultName) {
      if (imp.imports.length > 0) {
        return `import ${typePrefix}${imp.defaultName}, { ${imp.imports.join(', ')} } from '${from}';`;
      }
      return `import ${typePrefix}${imp.defaultName} from '${from}';`;
    }

    if (imp.imports.length === 0) {
      // For empty imports, generate side-effect import
      return `import '${from}';`;
    }

    return `import ${typePrefix}{ ${imp.imports.join(', ')} } from '${from}';`;
  }

  /**
   * Check if an import matching the predicate exists
   * @param predicate - Function to test each import
   * @returns True if at least one import matches
   */
  hasImport(predicate: (imp: Import) => boolean): boolean {
    return this.imports.some(predicate);
  }

  /**
   * Remove all imports matching the predicate
   * @param predicate - Function to test each import; returns true to remove
   * @returns This ImportManager for chaining
   */
  removeImports(predicate: (imp: Import) => boolean): this {
    this.imports = this.imports.filter(imp => !predicate(imp));
    return this;
  }

  clear(): this {
    this.imports.length = 0;
    return this;
  }

  /**
   * Get imports grouped by kind (internal vs external)
   * @returns Object with internal and external import arrays
   */
  getGroupedImports(): {
    internal: readonly InternalImport[];
    external: readonly ExternalImport[];
  } {
    const internal: InternalImport[] = [];
    const external: ExternalImport[] = [];

    for (const imp of this.imports) {
      if (imp.kind === 'internal') {
        internal.push(imp);
      } else {
        external.push(imp);
      }
    }

    return { internal, external };
  }

  /**
   * Deduplicate imports by merging those from the same source with compatible options.
   * Type-only and regular imports are kept separate, as are default and named imports.
   * Returns a new ImportManager instance with deduplicated imports.
   *
   * @returns A new ImportManager with deduplicated imports
   * @example
   * ```ts
   * const manager = new ImportManager()
   *   .addInternal('./types.js', 'User')
   *   .addInternal('./types.js', 'Product');
   * const deduped = manager.deduplicate();
   * // Results in single import: import { User, Product } from './types.js'
   * ```
   */
  deduplicate(): ImportManager {
    const mergedImports = new Map<string, Import>();

    for (const imp of this.imports) {
      // Include type-only and default status in key to prevent incorrect merging
      const key =
        imp.kind === 'internal'
          ? `internal:${imp.path}:${imp.isTypeOnly || false}:${imp.isDefault || false}`
          : `external:${imp.package}:${imp.isTypeOnly || false}:${imp.isDefault || false}`;

      const existing = mergedImports.get(key);
      if (existing) {
        // Only merge if they have exactly the same import characteristics
        const mergedImportsList = [...new Set([...existing.imports, ...imp.imports])];
        mergedImports.set(key, {
          ...existing,
          imports: mergedImportsList,
        });
      } else {
        mergedImports.set(key, imp);
      }
    }

    const deduplicated = new ImportManager();
    deduplicated.imports.push(...mergedImports.values());
    return deduplicated;
  }

  /**
   * Convert to PluginImports format
   * @deprecated Use build() instead
   */
  toPluginImports(): PluginImports {
    return this.build();
  }

  /**
   * Create a shallow copy of this ImportManager
   * @returns New ImportManager with the same imports
   */
  clone(): ImportManager {
    const cloned = new ImportManager();
    cloned.imports.push(...this.imports);
    return cloned;
  }
}

/**
 * Helper function to create a new ImportManager
 */
export function createImportManager(): ImportManager {
  return new ImportManager();
}
