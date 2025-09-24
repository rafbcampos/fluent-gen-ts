import type { Import, InternalImport, ExternalImport, PluginImports } from './plugin-types.js';

/**
 * Fluent API for managing plugin imports
 * Provides a type-safe way to declare import requirements without string manipulation
 */
export class ImportManager {
  private imports: Import[] = [];

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
    const importsList = Array.isArray(imports) ? imports : [imports];

    const internalImport: InternalImport = {
      kind: 'internal',
      path,
      imports: importsList,
      ...(options?.typeOnly !== undefined ? { isTypeOnly: options.typeOnly } : {}),
      ...(options?.isDefault !== undefined ? { isDefault: options.isDefault } : {}),
      ...(options?.defaultName !== undefined ? { defaultName: options.defaultName } : {}),
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
    const importsList = Array.isArray(imports) ? imports : [imports];

    const externalImport: ExternalImport = {
      kind: 'external',
      package: packageName,
      imports: importsList,
      ...(options?.typeOnly !== undefined ? { isTypeOnly: options.typeOnly } : {}),
      ...(options?.isDefault !== undefined ? { isDefault: options.isDefault } : {}),
      ...(options?.defaultName !== undefined ? { defaultName: options.defaultName } : {}),
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
   * Merge imports from another ImportManager
   * @param other - Another ImportManager instance
   */
  merge(other: ImportManager): this {
    this.imports.push(...other.getImports());
    return this;
  }

  /**
   * Get all configured imports
   */
  getImports(): readonly Import[] {
    return this.imports;
  }

  /**
   * Build the final plugin imports configuration
   */
  build(): PluginImports {
    return {
      imports: this.imports,
    };
  }

  /**
   * Convert imports to import statements
   * Useful for generating the actual import code
   */
  toImportStatements(): string[] {
    const statements: string[] = [];
    const { internal, external } = this.getGroupedImports();

    // Add internal imports first
    for (const imp of internal) {
      const statement = this.importToStatement(imp);
      if (statement) {
        statements.push(statement);
      }
    }

    // Add external imports second
    for (const imp of external) {
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
   * Check if an import already exists
   */
  hasImport(predicate: (imp: Import) => boolean): boolean {
    return this.imports.some(predicate);
  }

  /**
   * Remove imports matching a predicate
   */
  removeImports(predicate: (imp: Import) => boolean): this {
    const indicesToRemove: number[] = [];
    this.imports.forEach((imp, index) => {
      if (predicate(imp)) {
        indicesToRemove.push(index);
      }
    });

    // Remove in reverse order to maintain indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      const indexToRemove = indicesToRemove[i];
      if (indexToRemove !== undefined) {
        this.imports.splice(indexToRemove, 1);
      }
    }

    return this;
  }

  /**
   * Clear all imports
   */
  clear(): this {
    this.imports.length = 0;
    return this;
  }

  /**
   * Get imports grouped by source
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
   * Deduplicate imports by merging those from the same source with compatible options
   * Type-only imports and regular imports are kept separate
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
   */
  toPluginImports(): PluginImports {
    return {
      imports: this.imports,
    };
  }

  /**
   * Clone this ImportManager
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
