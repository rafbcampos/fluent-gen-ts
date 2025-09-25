import { Project } from 'ts-morph';
import type { ResolvedType } from '../../../core/types.js';
import type { DependencyInfo } from '../types.js';
import { validateTypeName } from '../utils/validation.js';
import { looksLikePackagePath, resolveRelativeImportPath } from '../utils/path-utils.js';

export class DependencyResolver {
  private project?: Project | undefined;

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

  dispose(): void {
    if (this.project) {
      this.project = undefined;
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
    importDecl: any,
    resolvedPath: string,
    dependencies: DependencyInfo[],
  ): void {
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      const importName = namedImport.getName();
      if (validateTypeName(importName)) {
        dependencies.push({
          typeName: importName,
          sourceFile: resolvedPath,
        });
      }
    }

    if (importDecl.isTypeOnly()) {
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport && validateTypeName(defaultImport.getText())) {
        dependencies.push({
          typeName: defaultImport.getText(),
          sourceFile: resolvedPath,
        });
      }
    }
  }
}
