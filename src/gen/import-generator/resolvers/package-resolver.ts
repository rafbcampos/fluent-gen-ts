import type { ResolvedType } from '../../../core/types.js';
import type { ModuleImportsResult } from '../types.js';
import { ImportResolver, type ImportInfo } from '../../../core/import-resolver.js';
import {
  looksLikePackagePath,
  extractPotentialPackageImports,
  createRelativeImportPath,
} from '../utils/path-utils.js';
import { NodeJSTypeResolver } from '../utils/nodejs-type-resolver.js';
import { ok, err, isOk, type Result } from '../../../core/result.js';

/**
 * Resolves package imports and generates import statements for TypeScript modules.
 * Handles both external packages (node_modules) and local file imports.
 */
export class PackageResolver {
  private readonly importResolver = new ImportResolver();
  private readonly nodeJSResolver = new NodeJSTypeResolver();

  /**
   * Validates that the resolved type has a valid structure with imports array.
   */
  private validateResolvedType(resolvedType: ResolvedType | null | undefined): Result<void, Error> {
    if (!resolvedType) {
      return err(new Error('ResolvedType is null or undefined'));
    }
    if (!Array.isArray(resolvedType.imports)) {
      return err(
        new Error(`ResolvedType.imports is not an array, got: ${typeof resolvedType.imports}`),
      );
    }
    return ok(undefined);
  }

  /**
   * Checks if the import path resolves to a node module.
   */
  private isNodeModule(importPath: string): boolean {
    const resolveResult = this.importResolver.resolve({ importPath });
    return isOk(resolveResult) && resolveResult.value.isNodeModule;
  }

  /**
   * Resolves an import path and returns the resolution result.
   */
  private resolveImport(importPath: string): Result<ImportInfo, Error> {
    return this.importResolver.resolve({ importPath });
  }

  /**
   * Generates module imports for all external dependencies found in the resolved type.
   * @param resolvedType - The resolved type information containing imports
   * @param excludeModules - Optional set of module names to exclude from generation
   * @returns Array of import statements or error
   * @example
   * ```ts
   * const result = resolver.generateModuleImports(resolvedType, new Set(['react']));
   * // Returns: ['import type * as Lodash from "lodash";']
   * ```
   */
  generateModuleImports(
    resolvedType: ResolvedType,
    excludeModules?: Set<string>,
  ): ModuleImportsResult {
    try {
      const validationResult = this.validateResolvedType(resolvedType);
      if (!isOk(validationResult)) {
        return err(validationResult.error);
      }

      const moduleImports: string[] = [];

      for (const imp of resolvedType.imports) {
        if (typeof imp !== 'string' || imp.trim() === '') {
          continue;
        }

        const resolveResult = this.resolveImport(imp);

        if (isOk(resolveResult) && resolveResult.value.isNodeModule) {
          const importInfo = resolveResult.value;
          const formattedPath = this.importResolver.formatImportPath({
            info: importInfo,
            sourceFilePath: resolvedType.sourceFile,
          });

          // Skip Node.js built-in modules - they don't need to be treated as external packages
          if (this.nodeJSResolver.isBuiltinModule(formattedPath)) {
            continue;
          }

          if (!excludeModules || !excludeModules.has(formattedPath)) {
            moduleImports.push(
              `import type * as ${importInfo.moduleName} from "${formattedPath}";`,
            );
          }
        }
      }

      return ok(moduleImports);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to generate module imports: ${message}`));
    }
  }

  /**
   * Generates type imports grouped by module from external type definitions.
   * @param externalTypes - Map of type names to their source file paths
   * @returns Array of import statements with grouped types or error
   * @example
   * ```ts
   * const types = new Map([['User', '/node_modules/react/index.d.ts']]);
   * const result = resolver.generateExternalTypeImports(types);
   * // Returns: ['import type { User } from "react";']
   * ```
   */
  generateExternalTypeImports(externalTypes: Map<string, string>): ModuleImportsResult {
    try {
      const moduleToTypes = new Map<string, string[]>();

      for (const [typeName, sourceFile] of externalTypes) {
        const moduleName = this.extractModuleNameFromPath(sourceFile);
        if (moduleName) {
          const typeList = moduleToTypes.get(moduleName) ?? [];
          typeList.push(typeName);
          moduleToTypes.set(moduleName, typeList);
        }
      }

      const imports: string[] = [];
      for (const [moduleName, types] of moduleToTypes) {
        const uniqueTypes = Array.from(new Set(types)).sort();
        imports.push(`import type { ${uniqueTypes.join(', ')} } from "${moduleName}";`);
      }

      return ok(imports);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to generate external type imports: ${message}`));
    }
  }

  /**
   * Resolves the import path for a given resolved type.
   * Attempts to resolve package imports first, then falls back to relative paths.
   * @param resolvedType - The resolved type containing source file information
   * @param outputDir - Optional output directory for generating relative paths
   * @returns The resolved import path
   * @throws Error if resolvedType or sourceFile is invalid
   */
  resolveImportPath(resolvedType: ResolvedType, outputDir?: string): string {
    if (!resolvedType || typeof resolvedType.sourceFile !== 'string') {
      throw new Error(
        `Invalid resolved type: ${!resolvedType ? 'null/undefined' : `sourceFile is ${typeof resolvedType.sourceFile}`}`,
      );
    }

    const sourceFile = resolvedType.sourceFile;

    if (looksLikePackagePath(sourceFile)) {
      const potentialImportPaths = extractPotentialPackageImports(sourceFile);

      for (const importPath of potentialImportPaths) {
        const resolveResult = this.resolveImport(importPath);
        if (isOk(resolveResult) && resolveResult.value.isNodeModule) {
          return this.importResolver.formatImportPath({
            info: resolveResult.value,
            sourceFilePath: sourceFile,
          });
        }
      }
    }

    if (outputDir && !looksLikePackagePath(sourceFile)) {
      return createRelativeImportPath(outputDir, sourceFile);
    }

    return sourceFile;
  }

  /**
   * Checks if the import is from a node module (external package).
   * This method name is preserved for backward compatibility.
   * @param importPath - The import path to check
   * @param resolvedType - The resolved type (parameter kept for backward compatibility)
   * @returns true if the import is from a node module, false otherwise
   * @deprecated Consider using isNodeModule() directly
   */
  shouldPreserveNamedImports(importPath: string, resolvedType: ResolvedType): boolean {
    if (!importPath || !resolvedType) {
      return false;
    }

    return this.isNodeModule(importPath);
  }

  /**
   * Extracts the module name from a file path containing node_modules.
   * Handles both regular npm and pnpm directory structures.
   * @param sourceFile - The source file path to extract module name from
   * @returns The module name or null if not found
   */
  private extractModuleNameFromPath(sourceFile: string): string | null {
    // Handle pnpm structure: /.pnpm/package@version/node_modules/package-name
    const pnpmIndex = sourceFile.indexOf('.pnpm/');
    if (pnpmIndex !== -1) {
      const afterPnpm = sourceFile.substring(pnpmIndex + 6); // 6 = '.pnpm/'.length
      const nodeModulesIndex = afterPnpm.indexOf('/node_modules/');

      if (nodeModulesIndex !== -1) {
        const afterNodeModules = afterPnpm.substring(nodeModulesIndex + 14); // 14 = '/node_modules/'.length
        return this.extractPackageNameFromSegment(afterNodeModules);
      }
    }

    // Handle regular npm structure: use lastIndexOf for better performance
    const nodeModulesIndex = sourceFile.lastIndexOf('node_modules/');
    if (nodeModulesIndex === -1) {
      return null;
    }

    const afterNodeModules = sourceFile.substring(nodeModulesIndex + 13); // 13 = 'node_modules/'.length
    return this.extractPackageNameFromSegment(afterNodeModules);
  }

  /**
   * Extracts package name from the segment after node_modules/.
   * Handles both regular packages (lodash) and scoped packages (@types/node).
   */
  private extractPackageNameFromSegment(segment: string): string | null {
    if (!segment) {
      return null;
    }

    // Handle scoped packages (@scope/package)
    if (segment.startsWith('@')) {
      const firstSlash = segment.indexOf('/');
      if (firstSlash === -1) {
        return null; // Invalid scoped package
      }

      const secondSlash = segment.indexOf('/', firstSlash + 1);
      if (secondSlash === -1) {
        // Package name is the rest of the segment (no subpath)
        return segment;
      }

      // Return @scope/package
      return segment.substring(0, secondSlash);
    }

    // Regular package
    const slashIndex = segment.indexOf('/');
    if (slashIndex === -1) {
      return segment;
    }

    return segment.substring(0, slashIndex);
  }

  /**
   * Disposes of resources used by the resolver.
   */
  dispose(): void {
    this.nodeJSResolver.dispose();
  }
}
