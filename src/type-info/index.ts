import { TypeScriptParser } from './parser.js';
import { TypeResolver } from './resolver.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { ResolvedType, TypeInfo } from '../core/types.js';
import { TypeResolutionCache } from '../core/cache.js';
import { PluginManager } from '../core/plugin.js';
import {
  isObjectTypeInfo,
  isArrayTypeInfo,
  isUnionTypeInfo,
  isIntersectionTypeInfo,
  isReferenceTypeInfo,
} from './type-guards.js';
import path from 'node:path';
import { access, constants } from 'node:fs/promises';
import type { SourceFile } from 'ts-morph';

export interface TypeExtractorOptions {
  tsConfigPath?: string;
  cache?: TypeResolutionCache;
  pluginManager?: PluginManager;
  maxDepth?: number;
}

export class TypeExtractor {
  private readonly parser: TypeScriptParser;
  private readonly resolver: TypeResolver;
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;

  constructor(options: TypeExtractorOptions = {}) {
    const validationResult = this.validateOptions(options);
    if (!validationResult.ok) {
      throw new Error(`Invalid TypeExtractor options: ${validationResult.error.message}`);
    }

    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();

    this.parser = new TypeScriptParser({
      ...(options.tsConfigPath && { tsConfigPath: options.tsConfigPath }),
      cache: this.cache,
      pluginManager: this.pluginManager,
    });

    this.resolver = new TypeResolver({
      ...(options.maxDepth && { maxDepth: options.maxDepth }),
      cache: this.cache,
      pluginManager: this.pluginManager,
      project: this.parser.getProject(),
    });
  }

  /**
   * Validates constructor options
   */
  private validateOptions(options: TypeExtractorOptions): Result<void> {
    if (options.maxDepth !== undefined && (options.maxDepth < 1 || options.maxDepth > 100)) {
      return err(new Error('maxDepth must be between 1 and 100'));
    }

    if (options.tsConfigPath !== undefined) {
      if (typeof options.tsConfigPath !== 'string' || options.tsConfigPath.trim() === '') {
        return err(new Error('tsConfigPath must be a non-empty string'));
      }
    }

    return ok(undefined);
  }

  /**
   * Validates file path parameter
   */
  private validateFilePath(filePath: string): Result<void> {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      return err(new Error('filePath must be a non-empty string'));
    }

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.d.ts')) {
      return err(new Error('filePath must be a TypeScript file (.ts, .tsx, or .d.ts)'));
    }

    return ok(undefined);
  }

  /**
   * Validates type name parameter
   */
  private validateTypeName(typeName: string): Result<void> {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return err(new Error('typeName must be a non-empty string'));
    }

    // Basic validation for valid TypeScript identifier
    const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    if (!identifierRegex.test(typeName)) {
      return err(new Error(`typeName '${typeName}' is not a valid TypeScript identifier`));
    }

    return ok(undefined);
  }

  /**
   * Checks if file exists and is readable
   */
  private async validateFileExists(filePath: string): Promise<Result<void>> {
    try {
      await access(filePath, constants.F_OK | constants.R_OK);
      return ok(undefined);
    } catch (error) {
      return err(new Error(`File '${filePath}' does not exist or is not readable: ${error}`));
    }
  }

  async extractType(filePath: string, typeName: string): Promise<Result<ResolvedType>> {
    // Validate inputs
    const filePathValidation = this.validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    const typeNameValidation = this.validateTypeName(typeName);
    if (!typeNameValidation.ok) {
      return typeNameValidation;
    }

    const absolutePath = path.resolve(filePath);

    // Check if file exists before proceeding
    const fileExistsValidation = await this.validateFileExists(absolutePath);
    if (!fileExistsValidation.ok) {
      return fileExistsValidation;
    }

    const sourceFileResult = await this.parser.parseFile(absolutePath);
    if (!sourceFileResult.ok) {
      return sourceFileResult;
    }

    const sourceFile = sourceFileResult.value;

    // Auto-detect and load external dependencies
    await this.loadExternalDependencies(sourceFile, path.dirname(absolutePath));

    // Normal type resolution
    const typeResult = await this.parser.findType({ sourceFile, typeName });
    if (!typeResult.ok) {
      return typeResult;
    }

    const type = typeResult.value;

    const typeInfoResult = await this.resolver.resolveType(type);
    if (!typeInfoResult.ok) {
      return typeInfoResult;
    }

    const importsResult = await this.parser.resolveImports(sourceFile);
    if (!importsResult.ok) {
      return importsResult;
    }

    const imports = Array.from(importsResult.value.keys());

    const dependencies = await this.resolveDependencies(
      typeInfoResult.value,
      sourceFile.getFilePath(),
    );

    if (!dependencies.ok) {
      return dependencies;
    }

    const resolvedType: ResolvedType = {
      sourceFile: absolutePath,
      name: typeName,
      typeInfo: typeInfoResult.value,
      imports,
      dependencies: dependencies.value,
    };

    return ok(resolvedType);
  }

  async extractMultiple(filePath: string, typeNames: string[]): Promise<Result<ResolvedType[]>> {
    // Validate file path
    const filePathValidation = this.validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    // Validate type names array
    if (!Array.isArray(typeNames)) {
      return err(new Error('typeNames must be an array'));
    }

    if (typeNames.length === 0) {
      return ok([]);
    }

    // Validate each type name
    for (const typeName of typeNames) {
      const typeNameValidation = this.validateTypeName(typeName);
      if (!typeNameValidation.ok) {
        return typeNameValidation;
      }
    }

    try {
      const extractionPromises = typeNames.map(typeName => this.extractType(filePath, typeName));

      const results = await Promise.all(extractionPromises);

      // Check if any extraction failed and return the first error
      for (const result of results) {
        if (!result.ok) {
          return result;
        }
      }

      // All successful, extract values
      const resolvedTypes = results.map(result => {
        if (result.ok) {
          return result.value;
        }
        throw new Error('Unexpected error: result should be ok at this point');
      });
      return ok(resolvedTypes);
    } catch (error) {
      return err(new Error(`Failed to extract multiple types: ${error}`));
    }
  }

  async scanFile(filePath: string): Promise<Result<string[]>> {
    // Validate file path
    const filePathValidation = this.validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    const absolutePath = path.resolve(filePath);

    // Check if file exists before proceeding
    const fileExistsValidation = await this.validateFileExists(absolutePath);
    if (!fileExistsValidation.ok) {
      return fileExistsValidation;
    }

    const sourceFileResult = await this.parser.parseFile(absolutePath);
    if (!sourceFileResult.ok) {
      return sourceFileResult;
    }

    try {
      const sourceFile = sourceFileResult.value;
      const typeNames: string[] = [];

      for (const interfaceDecl of sourceFile.getInterfaces()) {
        typeNames.push(interfaceDecl.getName());
      }

      for (const typeAlias of sourceFile.getTypeAliases()) {
        typeNames.push(typeAlias.getName());
      }

      return ok(typeNames);
    } catch (error) {
      return err(new Error(`Failed to scan file '${filePath}': ${error}`));
    }
  }

  private async resolveDependencies(
    typeInfo: TypeInfo,
    sourceFile: string,
  ): Promise<Result<ResolvedType[]>> {
    const dependencies: ResolvedType[] = [];
    const visited = new Set<string>();

    const collectDependencies = async (info: TypeInfo): Promise<Result<void>> => {
      if (isObjectTypeInfo(info)) {
        for (const prop of info.properties) {
          const result = await collectDependencies(prop.type);
          if (!result.ok) return result;
        }
      } else if (isArrayTypeInfo(info)) {
        const result = await collectDependencies(info.elementType);
        if (!result.ok) return result;
      } else if (isUnionTypeInfo(info)) {
        for (const unionType of info.unionTypes) {
          const result = await collectDependencies(unionType);
          if (!result.ok) return result;
        }
      } else if (isIntersectionTypeInfo(info)) {
        for (const intersectionType of info.intersectionTypes) {
          const result = await collectDependencies(intersectionType);
          if (!result.ok) return result;
        }
      } else if (isReferenceTypeInfo(info)) {
        if (!visited.has(info.name)) {
          visited.add(info.name);

          const depResult = await this.extractType(sourceFile, info.name);
          if (depResult.ok) {
            dependencies.push(depResult.value);
            const subResult = await collectDependencies(depResult.value.typeInfo);
            if (!subResult.ok) return subResult;
          }
        }
      }

      return ok(undefined);
    };

    const result = await collectDependencies(typeInfo);
    if (!result.ok) return result;

    return ok(dependencies);
  }

  /**
   * Auto-detect and load external dependencies from import statements
   */
  private async loadExternalDependencies(
    sourceFile: SourceFile,
    projectRoot: string,
  ): Promise<void> {
    try {
      const importDeclarations = sourceFile.getImportDeclarations();
      const externalPackages = new Set<string>();

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        // Check if it's an external package (not relative import)
        if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
          // Extract package name
          const packageName = moduleSpecifier.startsWith('@')
            ? moduleSpecifier.split('/').slice(0, 2).join('/') // @scope/package
            : moduleSpecifier.split('/')[0]; // package

          if (packageName) externalPackages.add(packageName);
        }
      }

      if (externalPackages.size > 0) {
        console.log(`Detected external packages: ${Array.from(externalPackages).join(', ')}`);

        // Find project root by looking for package.json
        let searchDir = projectRoot;
        while (searchDir !== path.dirname(searchDir)) {
          const packageJsonPath = path.join(searchDir, 'package.json');
          if (
            await access(packageJsonPath, constants.F_OK)
              .then(() => true)
              .catch(() => false)
          ) {
            projectRoot = searchDir;
            break;
          }
          searchDir = path.dirname(searchDir);
        }

        // Load the dependencies
        await this.parser.loadExternalDependencies(Array.from(externalPackages), projectRoot);
      }
    } catch (error) {
      console.warn(`Failed to load external dependencies: ${error}`);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.resolver.resetState();
  }
}

// Core types that consumers might need
export type {
  ResolvedType,
  TypeInfo,
  PropertyInfo,
  GenericParam,
  BuildContext,
  FluentBuilder,
} from '../core/types.js';
export { TypeKind, isFluentBuilder } from '../core/types.js';

// Result types for error handling
export type { Result, Ok, Err } from '../core/result.js';
export { ok, err, isOk, isErr } from '../core/result.js';

// Internal classes - only export if needed by advanced users
export { TypeScriptParser } from './parser.js';
export { TypeResolver } from './resolver.js';

// Cache and plugin system for advanced usage
export { TypeResolutionCache } from '../core/cache.js';
export { PluginManager } from '../core/plugin.js';
