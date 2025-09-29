import { Project, ImportDeclaration } from 'ts-morph';
import type { ResolvedType } from '../../../core/types.js';
import type { DependencyInfo } from '../types.js';
import { validateTypeName } from '../utils/validation.js';
import { looksLikePackagePath, resolveRelativeImportPath } from '../utils/path-utils.js';

/**
 * Resolves and discovers transitive dependencies in TypeScript source files.
 *
 * This class analyzes import declarations in TypeScript files to build a complete
 * dependency graph, following imports recursively to discover all transitive dependencies.
 * It uses ts-morph for parsing and handles both named and default imports while filtering
 * out external packages and invalid type names.
 */
export class DependencyResolver {
  private project?: Project;

  /**
   * Discovers all transitive dependencies starting from a resolved type's source file.
   *
   * Recursively analyzes import declarations to build a complete dependency graph.
   * Skips external packages (node_modules) and only includes valid TypeScript type names.
   *
   * @param resolvedType - The starting point for dependency discovery
   * @returns Array of dependency information including type names and their source files
   *
   * @example
   * ```typescript
   * const resolver = new DependencyResolver();
   * const resolvedType = { sourceFile: '/src/types.ts', ... };
   * const dependencies = resolver.discoverTransitiveDependencies(resolvedType);
   * // Returns: [{ typeName: 'User', sourceFile: '/src/models/user.ts' }, ...]
   * ```
   */
  discoverTransitiveDependencies(resolvedType: ResolvedType): DependencyInfo[] {
    try {
      if (!this.project) {
        this.project = new Project({
          useInMemoryFileSystem: false,
          skipFileDependencyResolution: true,
        });
      }

      const dependencies: DependencyInfo[] = [];
      const visited = new Set<string>();

      this.analyzeFile(resolvedType.sourceFile, dependencies, visited);

      return dependencies;
    } catch {
      return [];
    }
  }

  /**
   * Cleans up resources used by the dependency resolver.
   *
   * Removes all source files from the ts-morph project and clears the project reference.
   * This method should be called when the resolver is no longer needed to free memory.
   */
  dispose(): void {
    if (this.project) {
      // Clear all source files that were added during analysis
      try {
        this.project.getSourceFiles().forEach(sourceFile => {
          sourceFile.forget();
        });
      } catch {
        // Ignore errors during cleanup
      }
      delete this.project;
    }
  }

  private analyzeFile(
    filePath: string,
    dependencies: DependencyInfo[],
    visited: Set<string>,
  ): void {
    if (visited.has(filePath) || !filePath || looksLikePackagePath(filePath)) {
      return;
    }
    visited.add(filePath);

    try {
      if (!this.project) return;

      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const imports = sourceFile.getImportDeclarations();

      for (const importDecl of imports) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
          continue;
        }

        const resolvedPath = resolveRelativeImportPath(filePath, moduleSpecifier);
        if (!resolvedPath) continue;

        this.processImportDeclaration(importDecl, resolvedPath, dependencies);
        this.analyzeFile(resolvedPath, dependencies, visited);
      }
    } catch (error) {
      console.warn(`Error analyzing file ${filePath}:`, error);
    }
  }

  private processImportDeclaration(
    importDecl: ImportDeclaration,
    resolvedPath: string,
    dependencies: DependencyInfo[],
  ): void {
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      const importName = namedImport.getName();
      this.addDependencyIfValid(importName, resolvedPath, dependencies);
    }

    // Process default imports (they can exist in both regular and type-only imports)
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      this.addDependencyIfValid(defaultImport.getText(), resolvedPath, dependencies);
    }
  }

  private addDependencyIfValid(
    typeName: string,
    sourceFile: string,
    dependencies: DependencyInfo[],
  ): void {
    if (validateTypeName(typeName)) {
      dependencies.push({
        typeName,
        sourceFile,
      });
    }
  }
}
