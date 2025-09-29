import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Finds type definitions that are missing sourceFile information.
 * This happens when TypeScript resolves utility types like Pick<Base, 'messages'>
 * and the nested types lose their original source location.
 */
export class TypeDefinitionFinder {
  private project: Project | undefined;
  private readonly typeLocationCache = new Map<string, string | null>();

  /**
   * Finds the source file for a type by searching the codebase.
   * Handles interfaces, type aliases, classes, and re-exported types.
   *
   * @param typeName - The name of the type to find
   * @param startingFile - The file to start searching from
   * @returns The path to the file containing the type definition, or null if not found
   *
   * @example
   * ```typescript
   * const finder = new TypeDefinitionFinder();
   * const sourcePath = finder.findTypeSourceFile('UserModel', './src/index.ts');
   * console.log(sourcePath); // './src/models/user.ts'
   * ```
   */
  findTypeSourceFile(typeName: string, startingFile: string): string | null {
    if (!typeName || !startingFile) {
      return null;
    }

    // Check cache first
    const cacheKey = `${typeName}:${startingFile}`;
    if (this.typeLocationCache.has(cacheKey)) {
      return this.typeLocationCache.get(cacheKey) || null;
    }

    try {
      if (!this.project) {
        this.project = new Project({
          useInMemoryFileSystem: false,
          skipFileDependencyResolution: true,
        });
      }

      // Start searching from the starting file and its imports
      const visitedFiles = new Set<string>();
      const result = this.searchForType(typeName, startingFile, visitedFiles);

      // Cache the result
      this.typeLocationCache.set(cacheKey, result);

      return result;
    } catch {
      // Silently fail and cache null result
      this.typeLocationCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Recursively searches for a type definition through imports.
   *
   * @param typeName - The type name to search for
   * @param filePath - Current file being searched
   * @param visitedFiles - Set of already visited files to prevent infinite recursion
   * @returns Path to the file containing the type, or null if not found
   */
  private searchForType(
    typeName: string,
    filePath: string,
    visitedFiles: Set<string>,
  ): string | null {
    if (!fs.existsSync(filePath) || visitedFiles.has(filePath)) {
      return null;
    }

    visitedFiles.add(filePath);

    try {
      if (!this.project) {
        throw new Error('Project not initialized');
      }
      const sourceFile = this.project.addSourceFileAtPath(filePath);

      // Check if this file defines the type
      const hasType = this.fileDefinesType(sourceFile, typeName);
      if (hasType) {
        return filePath;
      }

      // Search through imports
      const imports = sourceFile.getImportDeclarations();
      for (const importDecl of imports) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        // Only follow relative imports
        if (!moduleSpecifier.startsWith('.')) {
          continue;
        }

        const resolvedPath = this.resolveImportPath(filePath, moduleSpecifier);
        if (resolvedPath) {
          const result = this.searchForType(typeName, resolvedPath, visitedFiles);
          if (result) {
            return result;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a source file defines a specific type.
   * Handles interfaces, type aliases, classes, and re-exported types.
   *
   * @param sourceFile - The ts-morph SourceFile to check
   * @param typeName - The type name to look for
   * @returns True if the file defines the type
   */
  private fileDefinesType(sourceFile: SourceFile, typeName: string): boolean {
    // Check all type declarations using a helper to reduce duplication
    const declarations = [
      ...sourceFile.getInterfaces(),
      ...sourceFile.getTypeAliases(),
      ...sourceFile.getClasses(),
    ];

    for (const decl of declarations) {
      if (decl.getName() === typeName) {
        return true;
      }
    }

    // Check for exported types in export declarations
    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      const namedExports = exportDecl.getNamedExports();
      for (const namedExport of namedExports) {
        if (namedExport.getName() === typeName) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Resolves an import path to an actual file path.
   * Handles TypeScript extensions and index files.
   *
   * @param fromFile - The file containing the import
   * @param importPath - The import path to resolve
   * @returns The resolved file path or null if not found
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);

    // Define extension mappings for cleaner code
    const extensions = ['.ts', '.tsx'];
    const jsExtensions: Record<string, string> = {
      '.js': '.ts',
      '.jsx': '.tsx',
    };

    // Build possible paths
    const possiblePaths: string[] = [];

    // Direct file with TypeScript extensions
    for (const ext of extensions) {
      possiblePaths.push(path.resolve(dir, `${importPath}${ext}`));
    }

    // Index files
    for (const ext of extensions) {
      possiblePaths.push(path.resolve(dir, `${importPath}/index${ext}`));
    }

    // JavaScript extensions mapped to TypeScript
    for (const [jsExt, tsExt] of Object.entries(jsExtensions)) {
      if (importPath.endsWith(jsExt)) {
        possiblePaths.push(path.resolve(dir, importPath.replace(new RegExp(`\\${jsExt}$`), tsExt)));
      }
    }

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return null;
  }

  /**
   * Disposes of internal resources and clears caches.
   * Should be called when the finder is no longer needed.
   */
  dispose(): void {
    this.typeLocationCache.clear();
    this.project = undefined;
  }
}
