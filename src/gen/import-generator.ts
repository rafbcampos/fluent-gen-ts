/**
 * Import generation utilities for builder code
 * Handles import statement generation and path resolution
 */

import path from 'node:path';
import type { ResolvedType, TypeInfo, GenericParam } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import type { PluginManager } from '../core/plugin.js';
import { ImportResolver } from '../core/import-resolver.js';
import { isValidImportableTypeName } from './types.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';

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
   * Generates imports for Node.js built-in types
   * @param resolvedType - The resolved type information
   */
  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    const imports: string[] = [];
    const nodeJSTypeMapping: Record<string, { module: string; types: Set<string> }> = {};

    // Helper function to add type to mapping
    const addType = (typeName: string, module: string) => {
      if (!nodeJSTypeMapping[module]) {
        nodeJSTypeMapping[module] = { module, types: new Set() };
      }
      nodeJSTypeMapping[module].types.add(typeName);
    };

    // Recursively scan for Node.js built-in types
    const scanForNodeJSTypes = (typeInfo: TypeInfo) => {
      if (typeInfo.kind === 'primitive') {
        switch (typeInfo.name) {
          case 'EventEmitter':
            addType('EventEmitter', 'events');
            break;
          case 'Readable':
          case 'Writable':
          case 'Transform':
          case 'Duplex':
            addType(typeInfo.name, 'stream');
            break;
          case 'URL':
          case 'URLSearchParams':
            addType(typeInfo.name, 'url');
            break;
          case 'Buffer':
            // Buffer is global in Node.js, no import needed
            break;
          case 'ProcessEnv':
            // ProcessEnv is part of NodeJS namespace - no additional import needed
            break;
        }
      }

      // Recursively scan object properties
      if (typeInfo.kind === 'object' && 'properties' in typeInfo && typeInfo.properties) {
        for (const prop of typeInfo.properties) {
          scanForNodeJSTypes(prop.type);
        }
      }

      // Recursively scan array elements
      if (typeInfo.kind === TypeKind.Array && 'elementType' in typeInfo && typeInfo.elementType) {
        scanForNodeJSTypes(typeInfo.elementType);
      }

      // Recursively scan union members
      if (typeInfo.kind === TypeKind.Union && 'unionTypes' in typeInfo && typeInfo.unionTypes) {
        for (const member of typeInfo.unionTypes) {
          scanForNodeJSTypes(member);
        }
      }

      // Recursively scan generic type arguments
      if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
        for (const arg of typeInfo.typeArguments) {
          scanForNodeJSTypes(arg);
        }
      }
    };

    // Scan the main type info
    scanForNodeJSTypes(resolvedType.typeInfo);

    // Generate import statements
    Object.values(nodeJSTypeMapping).forEach(({ module, types }) => {
      const typeList = Array.from(types).sort().join(', ');
      imports.push(`import { ${typeList} } from "${module}";`);
    });

    return imports;
  }

  /**
   * Generates module imports from resolved type dependencies
   * @param resolvedType - The resolved type information
   */
  generateModuleImports(resolvedType: ResolvedType): Result<string[]> {
    try {
      if (!resolvedType || !Array.isArray(resolvedType.imports)) {
        return err(new Error('Invalid resolved type or imports array'));
      }

      const moduleImports: string[] = [];

      for (const imp of resolvedType.imports) {
        if (typeof imp !== 'string' || imp.trim() === '') {
          continue; // Skip invalid import paths
        }

        const resolveResult = this.importResolver.resolve({
          importPath: imp,
        });

        if (resolveResult.ok && resolveResult.value.isNodeModule) {
          const importInfo = resolveResult.value;
          const formattedPath = this.importResolver.formatImportPath({
            info: importInfo,
            sourceFilePath: resolvedType.sourceFile,
          });
          moduleImports.push(`import type * as ${importInfo.moduleName} from "${formattedPath}";`);
        }
      }

      return ok(moduleImports);
    } catch (error) {
      return err(new Error(`Failed to generate module imports: ${error}`));
    }
  }

  /**
   * Generates common utility imports for builder files
   * @param config - Import generation configuration
   */
  generateCommonImports(config: ImportGeneratorConfig): string {
    if (!config || !config.isGeneratingMultiple) {
      return '';
    }

    if (typeof config.commonImportPath !== 'string' || config.commonImportPath.trim() === '') {
      throw new Error('Invalid common import path provided');
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
  generateAllImports({
    resolvedType,
    config,
  }: {
    resolvedType: ResolvedType;
    config: ImportGeneratorConfig;
  }): Result<string> {
    try {
      if (!resolvedType || !config) {
        return err(new Error('Invalid resolved type or configuration'));
      }

      const imports: string[] = [];

      // Add common imports
      const commonImports = this.generateCommonImports(config);
      if (commonImports) {
        imports.push(commonImports);
      }

      // Add Node.js built-in type imports
      const nodeImports = this.generateNodeJSImports(resolvedType);
      if (nodeImports.length > 0) {
        imports.push(...nodeImports);
      }

      // Add module imports
      const moduleImportsResult = this.generateModuleImports(resolvedType);
      if (!moduleImportsResult.ok) {
        return moduleImportsResult;
      }
      imports.push(...moduleImportsResult.value);

      // Add type imports
      const typeImportsResult = this.generateTypeImports(resolvedType);
      if (!typeImportsResult.ok) {
        return typeImportsResult;
      }
      imports.push(typeImportsResult.value);

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
            imp => !imports.some(existing => existing.includes(imp)),
          );
          imports.push(...typeOnlyImports);
        }
      }

      // Deduplicate imports
      const uniqueImports = this.deduplicateImports(imports);
      return ok(uniqueImports.join('\n'));
    } catch (error) {
      return err(new Error(`Failed to generate all imports: ${error}`));
    }
  }

  /**
   * Deduplicates import statements
   */
  private deduplicateImports(imports: string[]): string[] {
    if (!Array.isArray(imports)) {
      return [];
    }

    const seen = new Set<string>();
    const deduplicated: string[] = [];

    for (const imp of imports) {
      if (typeof imp !== 'string') {
        continue;
      }

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
  generateTypeImports(resolvedType: ResolvedType): Result<string> {
    try {
      if (!resolvedType || !resolvedType.name) {
        return err(new Error('Invalid resolved type or missing name'));
      }

      const imports: string[] = [resolvedType.name];

      // Add nested type names
      if (this.isObjectType(resolvedType.typeInfo)) {
        for (const prop of resolvedType.typeInfo.properties) {
          this.collectImportableTypes(prop.type, imports);
        }
      }

      // Add generic constraint types
      if (this.isObjectType(resolvedType.typeInfo) && resolvedType.typeInfo.genericParams) {
        for (const param of resolvedType.typeInfo.genericParams) {
          this.collectGenericTypeImports(param, imports);
        }
      }

      // Remove duplicates and filter out invalid type names
      const uniqueImports = Array.from(new Set(imports)).filter(isValidImportableTypeName);

      if (uniqueImports.length === 0) {
        return err(new Error('No valid importable types found'));
      }

      const importPath = this.resolveImportPath(resolvedType);
      return ok(`import type { ${uniqueImports.join(', ')} } from "${importPath}";`);
    } catch (error) {
      return err(new Error(`Failed to generate type imports: ${error}`));
    }
  }

  /**
   * Collects type imports from generic parameters
   */
  private collectGenericTypeImports(param: GenericParam, imports: string[]): void {
    if (!param || !Array.isArray(imports)) {
      return;
    }

    if (
      param.constraint &&
      'name' in param.constraint &&
      typeof param.constraint.name === 'string' &&
      isValidImportableTypeName(param.constraint.name)
    ) {
      imports.push(param.constraint.name);
    }
    if (
      param.default &&
      'name' in param.default &&
      typeof param.default.name === 'string' &&
      isValidImportableTypeName(param.default.name)
    ) {
      imports.push(param.default.name);
    }
  }

  /**
   * Resolves the import path for a type
   * For local files, returns the source file path as-is
   * For package files, attempts to resolve to proper import specifier
   */
  private resolveImportPath(resolvedType: ResolvedType): string {
    if (!resolvedType || typeof resolvedType.sourceFile !== 'string') {
      throw new Error('Invalid resolved type or source file path');
    }

    const sourceFile = resolvedType.sourceFile;

    // Check if this appears to be a package-related path
    // by looking for common package manager directory structures
    if (this.looksLikePackagePath(sourceFile)) {
      const potentialImportPaths = this.extractPotentialPackageImports(sourceFile);

      // Try each potential import path
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

    // For local files or when package resolution fails, return the source file path
    return sourceFile;
  }

  /**
   * Determines if a file path looks like it could be from a package
   * Uses heuristics to detect package manager structures
   */
  private looksLikePackagePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const parts = normalizedPath.split(path.sep);

    // Look for common package manager indicators
    return parts.some(
      part => part === 'node_modules' || part.startsWith('.pnpm') || part.includes('@'), // Often indicates scoped packages
    );
  }

  /**
   * Extracts potential package import paths from a file path
   * Tries to handle different package manager structures
   */
  private extractPotentialPackageImports(filePath: string): string[] {
    const potentialPaths: string[] = [];
    const normalizedPath = path.normalize(filePath);
    const parts = normalizedPath.split(path.sep);

    // Find package manager directory indices
    const packageDirIndices = parts
      .map((part, index) => {
        if (part === 'node_modules' || part.startsWith('.pnpm')) {
          return index;
        }
        return -1;
      })
      .filter(index => index !== -1);

    // Extract potential package paths from each package directory
    for (const dirIndex of packageDirIndices) {
      if (dirIndex < parts.length - 1) {
        const afterPackageDir = parts.slice(dirIndex + 1);
        const extracted = this.extractPackageNameFromParts(afterPackageDir);
        if (extracted) {
          potentialPaths.push(extracted);
        }
      }
    }

    return potentialPaths;
  }

  /**
   * Extracts package name from path parts after a package directory
   */
  private extractPackageNameFromParts(parts: string[]): string | null {
    if (parts.length === 0) {
      return null;
    }

    // Handle scoped packages
    if (parts[0] && parts[0].length > 0 && parts[0].charAt(0) === '@') {
      if (parts.length >= 2) {
        const scopedPackage = `${parts[0]}/${parts[1]}`;

        // For scoped packages, include subpath if meaningful
        if (parts.length > 2) {
          const subPath = this.cleanSubPath(parts.slice(2).join('/'));
          if (subPath) {
            return `${scopedPackage}/${subPath}`;
          }
        }
        return scopedPackage;
      }
    } else {
      // Regular package
      const packageName = parts[0];
      if (packageName) {
        // Include subpath if meaningful
        if (parts.length > 1) {
          const subPath = this.cleanSubPath(parts.slice(1).join('/'));
          if (subPath) {
            return `${packageName}/${subPath}`;
          }
        }
        return packageName;
      }
    }

    return null;
  }

  /**
   * Cleans a subpath by removing file extensions and index references
   */
  private cleanSubPath(subPath: string): string {
    if (!subPath) {
      return '';
    }

    // Remove file extensions
    const withoutExt = subPath.replace(/\.(d\.ts|ts|js)$/, '');

    // Remove index file references
    const cleaned = withoutExt.replace(/\/index$|^index$/, '');

    return cleaned === '.' ? '' : cleaned;
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
  private isImportableType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { name: string }> {
    return this.isObjectType(typeInfo) && isValidImportableTypeName(typeInfo.name);
  }

  /**
   * Checks if a type is a global type that doesn't need importing
   * Uses globalThis to detect built-in types and global constructors
   */
  private isGlobalType(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    try {
      // Check if the type exists as a property of globalThis
      // This covers built-in constructors like Date, Array, Object, etc.
      return typeName in globalThis && typeof (globalThis as any)[typeName] === 'function';
    } catch {
      // If there's any error accessing globalThis, assume it's not global
      return false;
    }
  }

  /**
   * Recursively collects all importable type names from a type
   */
  private collectImportableTypes(typeInfo: TypeInfo, imports: string[]): void {
    if (!typeInfo || !Array.isArray(imports)) {
      return;
    }

    // Skip function types - method signatures should not be imported
    if (typeInfo.kind === TypeKind.Function) {
      return;
    }

    // Handle object types
    if (this.isImportableType(typeInfo)) {
      // Check if this is a global type that doesn't need importing
      if (!this.isGlobalType(typeInfo.name)) {
        imports.push(typeInfo.name);
      }
      return;
    }

    // Handle array types - extract element type
    if (typeInfo.kind === TypeKind.Array) {
      this.collectImportableTypes(typeInfo.elementType, imports);
      return;
    }

    // Handle union types - process all union members
    if (typeInfo.kind === TypeKind.Union) {
      for (const unionType of typeInfo.unionTypes) {
        this.collectImportableTypes(unionType, imports);
      }
      return;
    }

    // Handle intersection types - process all intersection members
    if (typeInfo.kind === TypeKind.Intersection) {
      for (const intersectionType of typeInfo.intersectionTypes) {
        this.collectImportableTypes(intersectionType, imports);
      }
      return;
    }

    // For other types (primitives, etc.), no imports needed
  }
}
