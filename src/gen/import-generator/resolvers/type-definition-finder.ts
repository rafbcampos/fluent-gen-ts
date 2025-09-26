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
  private readonly visitedFiles = new Set<string>();

  /**
   * Finds the source file for a type by searching the codebase
   * @param typeName The name of the type to find
   * @param startingFile The file to start searching from
   * @returns The path to the file containing the type definition, or null if not found
   */
  findTypeSourceFile(typeName: string, startingFile: string): string | null {
    if (!typeName || !startingFile) {
      return null;
    }

    // Check cache first
    const cacheKey = `${typeName}:${startingFile}`;
    if (this.typeLocationCache.has(cacheKey)) {
      return this.typeLocationCache.get(cacheKey) ?? null;
    }

    try {
      if (!this.project) {
        this.project = new Project({
          useInMemoryFileSystem: false,
          skipFileDependencyResolution: true,
        });
      }

      // Start searching from the starting file and its imports
      const result = this.searchForType(typeName, startingFile);

      // Cache the result
      this.typeLocationCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.warn(`Failed to find source for type ${typeName}:`, error);
      this.typeLocationCache.set(cacheKey, null);
      return null;
    }
  }

  private searchForType(typeName: string, filePath: string): string | null {
    if (!fs.existsSync(filePath) || this.visitedFiles.has(filePath)) {
      return null;
    }

    this.visitedFiles.add(filePath);

    try {
      const sourceFile = this.project!.addSourceFileAtPath(filePath);

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
          const result = this.searchForType(typeName, resolvedPath);
          if (result) {
            return result;
          }
        }
      }

      return null;
    } catch {
      return null;
    } finally {
      this.visitedFiles.delete(filePath);
    }
  }

  private fileDefinesType(sourceFile: SourceFile, typeName: string): boolean {
    // Check for interface declarations
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      if (iface.getName() === typeName) {
        return true;
      }
    }

    // Check for type alias declarations
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      if (typeAlias.getName() === typeName) {
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

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const possiblePaths = [
      path.resolve(dir, `${importPath}.ts`),
      path.resolve(dir, `${importPath}.tsx`),
      path.resolve(dir, `${importPath}/index.ts`),
      path.resolve(dir, `${importPath}/index.tsx`),
      path.resolve(dir, importPath.replace(/\.js$/, '.ts')),
      path.resolve(dir, importPath.replace(/\.jsx$/, '.tsx')),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return null;
  }

  dispose(): void {
    this.typeLocationCache.clear();
    this.visitedFiles.clear();
    this.project = undefined;
  }
}
