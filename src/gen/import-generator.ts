/**
 * Import generation utilities for builder code
 * Handles import statement generation and path resolution
 */

import type { ResolvedType, TypeInfo, GenericParam } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import type { PluginManager } from "../core/plugin.js";
import { ImportResolver } from "../core/import-resolver.js";
import { isValidImportableTypeName } from "./types.js";

/**
 * Configuration for import generation
 */
export interface ImportGeneratorConfig {
  /** Whether generating multiple files */
  readonly isGeneratingMultiple: boolean;
  /** Path to common utilities */
  readonly commonImportPath: string;
  /** Plugin manager for additional imports */
  readonly pluginManager?: PluginManager;
}

/**
 * Generates import statements for builder files
 */
export class ImportGenerator {
  private readonly importResolver = new ImportResolver();

  /**
   * Generates module imports from resolved type dependencies
   * @param resolvedType - The resolved type information
   * @param pluginManager - Optional plugin manager for additional imports
   */
  generateModuleImports(resolvedType: ResolvedType, _pluginManager?: PluginManager): string[] {
    const moduleImports: string[] = [];

    for (const imp of resolvedType.imports) {
      const resolveResult = this.importResolver.resolve({
        sourceFile: resolvedType.sourceFile,
        importPath: imp,
      });

      if (resolveResult.ok && resolveResult.value.isNodeModule) {
        const importInfo = resolveResult.value;
        const formattedPath = this.importResolver.formatImportPath(
          importInfo,
          resolvedType.sourceFile,
        );
        moduleImports.push(
          `import type * as ${importInfo.moduleName} from "${formattedPath}";`,
        );
      }
    }

    return moduleImports;
  }

  /**
   * Generates common utility imports for builder files
   * @param config - Import generation configuration
   */
  generateCommonImports(config: ImportGeneratorConfig): string {
    if (!config.isGeneratingMultiple) {
      return "";
    }

    return `import {
  FluentBuilder,
  FluentBuilderBase,
  BaseBuildContext,
  FLUENT_BUILDER_SYMBOL,
  createInspectMethod
} from "${config.commonImportPath}";`;
  }

  /**
   * Generates all imports including plugin imports
   * @param resolvedType - The resolved type information
   * @param config - Import generation configuration
   */
  generateAllImports(
    resolvedType: ResolvedType,
    config: ImportGeneratorConfig
  ): string {
    const imports: string[] = [];

    // Add common imports
    const commonImports = this.generateCommonImports(config);
    if (commonImports) {
      imports.push(commonImports);
    }

    // Add module imports
    const moduleImports = this.generateModuleImports(resolvedType, config.pluginManager);
    imports.push(...moduleImports);

    // Add type imports
    const typeImports = this.generateTypeImports(resolvedType);
    imports.push(typeImports);

    // Add plugin imports if available
    if (config.pluginManager) {
      const pluginImports = config.pluginManager.getRequiredImports();

      // Add runtime imports
      if (pluginImports.runtime && pluginImports.runtime.length > 0) {
        imports.push(...pluginImports.runtime);
      }

      // Add type imports
      if (pluginImports.types && pluginImports.types.length > 0) {
        const typeOnlyImports = pluginImports.types.filter(
          imp => !imports.some(existing => existing.includes(imp))
        );
        imports.push(...typeOnlyImports);
      }
    }

    // Deduplicate imports
    const uniqueImports = this.deduplicateImports(imports);
    return uniqueImports.join("\n");
  }

  /**
   * Deduplicates import statements
   */
  private deduplicateImports(imports: string[]): string[] {
    const seen = new Set<string>();
    const deduplicated: string[] = [];

    for (const imp of imports) {
      const normalized = imp.trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(imp);
      }
    }

    return deduplicated;
  }

  /**
   * Generates type imports from source files
   * @param resolvedType - The resolved type information
   */
  generateTypeImports(resolvedType: ResolvedType): string {
    const imports: string[] = [resolvedType.name];

    // Add nested type names
    if (this.isObjectType(resolvedType.typeInfo)) {
      for (const prop of resolvedType.typeInfo.properties) {
        if (this.isImportableType(prop.type)) {
          imports.push(prop.type.name);
        }
      }
    }

    // Add generic constraint types
    if (
      this.isObjectType(resolvedType.typeInfo) &&
      resolvedType.typeInfo.genericParams
    ) {
      for (const param of resolvedType.typeInfo.genericParams) {
        this.collectGenericTypeImports(param, imports);
      }
    }

    // Remove duplicates and filter out invalid type names
    const uniqueImports = Array.from(new Set(imports)).filter(isValidImportableTypeName);

    const importPath = this.resolveImportPath(resolvedType);
    return `import type { ${uniqueImports.join(", ")} } from "${importPath}";`;
  }

  /**
   * Collects type imports from generic parameters
   */
  private collectGenericTypeImports(param: GenericParam, imports: string[]): void {
    if (
      param.constraint &&
      "name" in param.constraint &&
      isValidImportableTypeName(param.constraint.name)
    ) {
      imports.push(param.constraint.name);
    }
    if (
      param.default &&
      "name" in param.default &&
      isValidImportableTypeName(param.default.name)
    ) {
      imports.push(param.default.name);
    }
  }

  /**
   * Resolves the import path for a type
   */
  private resolveImportPath(resolvedType: ResolvedType): string {
    let importPath = resolvedType.sourceFile;

    // Check if the source file path looks like a node_modules path
    if (resolvedType.sourceFile.includes("node_modules")) {
      // Extract the module path from node_modules
      const match = resolvedType.sourceFile.match(
        /node_modules[/\\](.+?)\.d\.ts$/,
      );
      if (match && match[1]) {
        const modulePathResult = this.importResolver.resolve({
          sourceFile: resolvedType.sourceFile,
          importPath: match[1],
        });

        if (modulePathResult.ok) {
          importPath = this.importResolver.formatImportPath(
            modulePathResult.value,
            resolvedType.sourceFile,
          );
        }
      }
    }

    return importPath;
  }

  /**
   * Type guard to check if typeInfo is an object type
   */
  private isObjectType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }

  /**
   * Type guard to check if a type can be imported
   */
  private isImportableType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { name: string }> {
    return this.isObjectType(typeInfo) && isValidImportableTypeName(typeInfo.name);
  }
}