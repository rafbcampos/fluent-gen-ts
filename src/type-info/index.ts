// Node.js built-ins
import path from 'node:path';
import { access, constants } from 'node:fs/promises';

// External dependencies
import type { SourceFile } from 'ts-morph';

// Core modules
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { formatError } from '../core/utils/error-utils.js';
import type { ResolvedType, TypeInfo } from '../core/types.js';
import { TypeResolutionCache } from '../core/cache.js';
import { PluginManager } from '../core/plugin/index.js';
import type { MonorepoConfig } from '../core/package-resolver.js';

// Type-info modules
import { TypeScriptParser } from './parser.js';
import { TypeResolver } from './resolver/index.js';
import {
  isObjectTypeInfo,
  isArrayTypeInfo,
  isUnionTypeInfo,
  isIntersectionTypeInfo,
  isReferenceTypeInfo,
} from './type-guards.js';

/**
 * Reserved TypeScript keywords that cannot be used as type names
 */
const TYPESCRIPT_RESERVED_KEYWORDS = new Set([
  'abstract',
  'any',
  'as',
  'asserts',
  'assert',
  'async',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unique',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/**
 * Configuration options for TypeExtractor
 */
export interface TypeExtractorOptions {
  /** Path to TypeScript configuration file. If not provided, will use default resolution. */
  tsConfigPath?: string;
  /** Cache instance for type resolution. If not provided, a new cache will be created. */
  cache?: TypeResolutionCache;
  /** Plugin manager for extending functionality. If not provided, a new instance will be created. */
  pluginManager?: PluginManager;
  /** Maximum depth for type resolution to prevent infinite recursion. Must be between 1 and 100. */
  maxDepth?: number;
  /** Configuration for monorepo support. */
  monorepoConfig?: MonorepoConfig;
}

/**
 * Main class for extracting TypeScript type information from source files.
 *
 * Provides functionality to:
 * - Extract individual type definitions from TypeScript files
 * - Extract multiple types in parallel
 * - Scan files to discover available type definitions
 * - Resolve type dependencies and import relationships
 *
 * @example
 * ```typescript
 * const extractor = new TypeExtractor({
 *   tsConfigPath: './tsconfig.json',
 *   maxDepth: 10
 * });
 *
 * const result = await extractor.extractType('./types.ts', 'User');
 * if (result.ok) {
 *   console.log(result.value.typeInfo);
 * }
 * ```
 */
export class TypeExtractor {
  private static readonly MAX_PACKAGE_JSON_SEARCH_DEPTH = 50;

  private readonly parser: TypeScriptParser;
  private readonly resolver: TypeResolver;
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;

  /**
   * Creates a new TypeExtractor instance.
   *
   * @param options - Configuration options for the extractor
   * @throws {Error} If options validation fails (e.g., invalid maxDepth or tsConfigPath)
   */
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
      ...(options.monorepoConfig && { monorepoConfig: options.monorepoConfig }),
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
   * Validates file path parameter and returns absolute path
   */
  private async validateAndResolvePath(filePath: string): Promise<Result<string>> {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      return err(new Error('filePath must be a non-empty string'));
    }

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.d.ts')) {
      return err(new Error('filePath must be a TypeScript file (.ts, .tsx, or .d.ts)'));
    }

    const absolutePath = path.resolve(filePath);

    // Check if file exists
    try {
      await access(absolutePath, constants.F_OK | constants.R_OK);
      return ok(absolutePath);
    } catch (error) {
      return err(
        new Error(
          `File '${absolutePath}' does not exist or is not readable: ${formatError(error)}`,
        ),
      );
    }
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

    // Check for reserved keywords
    if (TYPESCRIPT_RESERVED_KEYWORDS.has(typeName.toLowerCase())) {
      return err(new Error(`typeName '${typeName}' is not a valid TypeScript identifier`));
    }

    return ok(undefined);
  }

  /**
   * Validates file path and type name, returning absolute path if valid
   */
  private async validateInputs(filePath: string, typeName: string): Promise<Result<string>> {
    const typeNameValidation = this.validateTypeName(typeName);
    if (!typeNameValidation.ok) {
      return typeNameValidation;
    }

    return await this.validateAndResolvePath(filePath);
  }

  /**
   * Extracts a single type definition from a TypeScript file.
   *
   * @param filePath - Path to the TypeScript file (.ts, .tsx, or .d.ts)
   * @param typeName - Name of the type to extract (must be a valid TypeScript identifier)
   * @returns Promise resolving to Result containing the resolved type information or error
   *
   * @example
   * ```typescript
   * const result = await extractor.extractType('./user.ts', 'User');
   * if (result.ok) {
   *   console.log('Type:', result.value.name);
   *   console.log('Properties:', result.value.typeInfo.properties);
   * } else {
   *   console.error('Error:', result.error.message);
   * }
   * ```
   */
  async extractType(filePath: string, typeName: string): Promise<Result<ResolvedType>> {
    // Validate inputs and get absolute path
    const absolutePathResult = await this.validateInputs(filePath, typeName);
    if (!absolutePathResult.ok) {
      return absolutePathResult;
    }

    const absolutePath = absolutePathResult.value;

    const sourceFileResult = await this.parser.parseFile(absolutePath);
    if (!sourceFileResult.ok) {
      return sourceFileResult;
    }

    const sourceFile = sourceFileResult.value;

    // Auto-detect and load external dependencies (warnings collected but not shown here)
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

  /**
   * Extracts multiple type definitions from a TypeScript file in parallel.
   *
   * @param filePath - Path to the TypeScript file (.ts, .tsx, or .d.ts)
   * @param typeNames - Array of type names to extract (each must be a valid TypeScript identifier)
   * @returns Promise resolving to Result containing array of resolved types or error
   *
   * @example
   * ```typescript
   * const result = await extractor.extractMultiple('./types.ts', ['User', 'Address', 'Profile']);
   * if (result.ok) {
   *   result.value.forEach(type => console.log('Extracted:', type.name));
   * } else {
   *   console.error('Error:', result.error.message);
   * }
   * ```
   */
  async extractMultiple(filePath: string, typeNames: string[]): Promise<Result<ResolvedType[]>> {
    // Validate type names array
    if (!Array.isArray(typeNames)) {
      return err(new Error('typeNames must be an array'));
    }

    if (typeNames.length === 0) {
      return ok([]);
    }

    // Validate file path once
    const absolutePathResult = await this.validateAndResolvePath(filePath);
    if (!absolutePathResult.ok) {
      return absolutePathResult;
    }

    // Validate each type name
    for (const typeName of typeNames) {
      const typeNameValidation = this.validateTypeName(typeName);
      if (!typeNameValidation.ok) {
        return typeNameValidation;
      }
    }

    try {
      // Parse file once and reuse for all type extractions
      const absolutePath = absolutePathResult.value;
      const sourceFileResult = await this.parser.parseFile(absolutePath);
      if (!sourceFileResult.ok) {
        return sourceFileResult;
      }

      const sourceFile = sourceFileResult.value;

      // Load external dependencies once
      await this.loadExternalDependencies(sourceFile, path.dirname(absolutePath));

      // Extract all types in parallel, reusing the parsed source file
      const extractionPromises = typeNames.map(async typeName => {
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
      });

      const results = await Promise.all(extractionPromises);

      // Check if any extraction failed and return the first error
      for (const result of results) {
        if (!result.ok) {
          return result;
        }
      }

      // All successful - extract values with proper type safety
      const resolvedTypes: ResolvedType[] = [];
      for (const result of results) {
        if (result.ok) {
          resolvedTypes.push(result.value);
        }
      }
      return ok(resolvedTypes);
    } catch (error) {
      return err(new Error(`Failed to extract multiple types: ${formatError(error)}`));
    }
  }

  /**
   * Scans a TypeScript file to discover all available type definitions.
   *
   * @param filePath - Path to the TypeScript file (.ts, .tsx, or .d.ts)
   * @returns Promise resolving to Result containing array of type names or error
   *
   * @example
   * ```typescript
   * const result = await extractor.scanFile('./types.ts');
   * if (result.ok) {
   *   console.log('Available types:', result.value);
   *   // Output: ['User', 'Address', 'Profile', ...]
   * } else {
   *   console.error('Error:', result.error.message);
   * }
   * ```
   */
  async scanFile(filePath: string): Promise<Result<string[]>> {
    // Validate file path and get absolute path
    const absolutePathResult = await this.validateAndResolvePath(filePath);
    if (!absolutePathResult.ok) {
      return absolutePathResult;
    }

    const absolutePath = absolutePathResult.value;

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
      return err(new Error(`Failed to scan file '${filePath}': ${formatError(error)}`));
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
  ): Promise<string[]> {
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
      // Find project root by looking for package.json (with max depth protection)
      let searchDir = projectRoot;
      let maxIterations = TypeExtractor.MAX_PACKAGE_JSON_SEARCH_DEPTH;
      while (searchDir !== path.dirname(searchDir) && maxIterations > 0) {
        const packageJsonPath = path.join(searchDir, 'package.json');
        try {
          await access(packageJsonPath, constants.F_OK);
          projectRoot = searchDir;
          break;
        } catch {
          // Continue searching in parent directory
        }
        searchDir = path.dirname(searchDir);
        maxIterations--;
      }

      // Load the dependencies
      const result = await this.parser.loadExternalDependencies(
        Array.from(externalPackages),
        projectRoot,
      );
      if (result.ok) {
        return result.value.warnings;
      }
    }
    return [];
  }

  /**
   * Clears all cached type resolution data and resets internal state.
   *
   * This is useful when you want to ensure fresh type resolution,
   * for example after TypeScript files have been modified.
   *
   * @example
   * ```typescript
   * extractor.clearCache();
   * // Now subsequent extractions will re-parse and re-resolve types
   * ```
   */
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
export { TypeResolver } from './resolver/index.js';

// Cache and plugin system for advanced usage
export { TypeResolutionCache } from '../core/cache.js';
export { PluginManager } from '../core/plugin/index.js';
