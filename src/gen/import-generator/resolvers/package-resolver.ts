import type { ResolvedType } from '../../../core/types.js';
import type { ModuleImportsResult } from '../types.js';
import { ImportResolver } from '../../../core/import-resolver.js';
import {
  looksLikePackagePath,
  extractPotentialPackageImports,
  createRelativeImportPath,
} from '../utils/path-utils.js';
import { NodeJSTypeResolver } from '../utils/nodejs-type-resolver.js';
import { ok, err } from '../../../core/result.js';

export class PackageResolver {
  private readonly importResolver = new ImportResolver();
  private readonly nodeJSResolver = new NodeJSTypeResolver();

  generateModuleImports(
    resolvedType: ResolvedType,
    excludeModules?: Set<string>,
  ): ModuleImportsResult {
    try {
      if (!resolvedType || !Array.isArray(resolvedType.imports)) {
        return err(new Error('Invalid resolved type or imports array'));
      }

      const moduleImports: string[] = [];

      for (const imp of resolvedType.imports) {
        if (typeof imp !== 'string' || imp.trim() === '') {
          continue;
        }

        const resolveResult = this.importResolver.resolve({ importPath: imp });

        if (resolveResult.ok && resolveResult.value.isNodeModule) {
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
      return err(new Error(`Failed to generate module imports: ${error}`));
    }
  }

  generateExternalTypeImports(externalTypes: Map<string, string>): ModuleImportsResult {
    try {
      const moduleToTypes = new Map<string, string[]>();

      for (const [typeName, sourceFile] of externalTypes) {
        const moduleName = this.extractModuleNameFromPath(sourceFile);
        if (moduleName) {
          if (!moduleToTypes.has(moduleName)) {
            moduleToTypes.set(moduleName, []);
          }
          const typeList = moduleToTypes.get(moduleName);
          if (typeList) {
            typeList.push(typeName);
          }
        }
      }

      const imports: string[] = [];
      for (const [moduleName, types] of moduleToTypes) {
        const uniqueTypes = Array.from(new Set(types)).sort();
        imports.push(`import type { ${uniqueTypes.join(', ')} } from "${moduleName}";`);
      }

      return ok(imports);
    } catch (error) {
      return err(new Error(`Failed to generate external type imports: ${error}`));
    }
  }

  resolveImportPath(resolvedType: ResolvedType, outputDir?: string): string {
    if (!resolvedType || typeof resolvedType.sourceFile !== 'string') {
      throw new Error('Invalid resolved type or source file path');
    }

    const sourceFile = resolvedType.sourceFile;

    if (looksLikePackagePath(sourceFile)) {
      const potentialImportPaths = extractPotentialPackageImports(sourceFile);

      for (const importPath of potentialImportPaths) {
        const resolveResult = this.importResolver.resolve({ importPath });

        if (resolveResult.ok && resolveResult.value.isNodeModule) {
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

  shouldPreserveNamedImports(importPath: string, resolvedType: ResolvedType): boolean {
    if (!importPath || !resolvedType) {
      return false;
    }

    const resolveResult = this.importResolver.resolve({ importPath });
    if (!resolveResult.ok || !resolveResult.value.isNodeModule) {
      return false;
    }

    return true;
  }

  private extractModuleNameFromPath(sourceFile: string): string | null {
    const pnpmMatch = sourceFile.match(/\.pnpm\/([^@]+@[^/]+)\/node_modules\/([^/]+(?:\/[^/]+)?)/);
    if (pnpmMatch?.[2]) {
      return pnpmMatch[2];
    }

    const matches = Array.from(sourceFile.matchAll(/node_modules\/([^/]+(?:\/[^/]+)?)/g));
    const lastMatch = matches[matches.length - 1];
    if (lastMatch?.[1]) {
      return lastMatch[1];
    }

    return null;
  }

  dispose(): void {
    this.nodeJSResolver.dispose();
  }
}
