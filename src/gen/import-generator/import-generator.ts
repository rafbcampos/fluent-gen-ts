import type { ResolvedType } from '../../core/types.js';
import type { Result } from '../../core/result.js';
import type { ImportGeneratorConfig, ImportGenerationContext } from './types.js';
import { NodeJSImportsGenerator } from './generators/nodejs-imports.js';
import { CommonImportsGenerator } from './generators/common-imports.js';
import { TypeImportsGenerator } from './generators/type-imports.js';
import { PackageResolver } from './resolvers/package-resolver.js';
import { PluginIntegration } from './plugins/plugin-integration.js';
import { extractModulesFromNamedImports } from './utils/deduplication.js';
import { ok, err } from '../../core/result.js';
import { formatError } from '../../core/utils/error-utils.js';

function hasDispose(obj: unknown): obj is { dispose(): void } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return 'dispose' in record && typeof record.dispose === 'function';
}

function isValidImportPath(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function addToImportsIfNotEmpty(imports: string[], value: string): void {
  if (value) {
    imports.push(value);
  }
}

/**
 * Central orchestrator for generating TypeScript import statements.
 *
 * Coordinates between specialized generators to produce comprehensive import statements
 * including Node.js modules, external packages, type imports, and common imports.
 *
 * @example
 * ```typescript
 * const generator = new ImportGenerator('./tsconfig.json');
 * const context = { resolvedType, config };
 * const result = await generator.generateAllImports(context);
 * if (result.ok) {
 *   console.log(result.value); // Generated import statements
 * }
 * ```
 */
export class ImportGenerator {
  private readonly nodeJSGenerator: NodeJSImportsGenerator;
  private readonly commonGenerator = new CommonImportsGenerator();
  private readonly typeGenerator = new TypeImportsGenerator();
  private readonly packageResolver = new PackageResolver();
  private readonly pluginIntegration = new PluginIntegration();

  /**
   * Creates a new ImportGenerator instance.
   *
   * @param tsConfigPath - Optional path to TypeScript configuration file for enhanced
   *                      Node.js module resolution. If not provided, falls back to
   *                      pattern-based detection.
   */
  constructor(tsConfigPath?: string) {
    this.nodeJSGenerator = new NodeJSImportsGenerator(tsConfigPath);
  }

  /**
   * Generates comprehensive import statements for a TypeScript type.
   *
   * Orchestrates all import generation steps in the correct order:
   * 1. Common imports (shared utilities)
   * 2. Node.js standard library imports
   * 3. Type imports (from local and external sources)
   * 4. Module imports (external packages)
   * 5. Plugin-based import processing
   *
   * @param context - Generation context containing resolved type and configuration
   * @returns Promise resolving to Result with generated import statements or error
   *
   * @example
   * ```typescript
   * const context = {
   *   resolvedType: { name: 'User', sourceFile: './types/user.ts', ... },
   *   config: { isGeneratingMultiple: true, outputDir: './dist', ... }
   * };
   * const result = await generator.generateAllImports(context);
   * ```
   */
  async generateAllImports(context: ImportGenerationContext): Promise<Result<string, Error>> {
    try {
      const { resolvedType, config } = context;

      if (!resolvedType || !config) {
        return err(new Error('Invalid resolved type or configuration'));
      }

      const imports: string[] = [];

      this.addNodeJSImports(resolvedType, imports);

      const typeImportsResult = await this.addTypeImports(resolvedType, config, imports);
      if (!typeImportsResult.ok) {
        return typeImportsResult;
      }

      const moduleImportsResult = this.addModuleImports(
        resolvedType,
        typeImportsResult.value,
        imports,
      );

      if (!moduleImportsResult.ok) {
        return moduleImportsResult;
      }

      const commonImportsResult = this.addCommonImports(config, imports);
      if (!commonImportsResult.ok) {
        return commonImportsResult;
      }

      const finalResult = await this.pluginIntegration.processPluginImports(
        imports,
        resolvedType,
        config,
      );

      return finalResult;
    } catch (error) {
      return err(new Error(`Failed to generate all imports: ${formatError(error)}`));
    }
  }

  /**
   * Generates Node.js standard library import statements.
   *
   * @param resolvedType - Type information to analyze for Node.js dependencies
   * @returns Array of Node.js import statements
   *
   * @example
   * ```typescript
   * const imports = generator.generateNodeJSImports(resolvedType);
   * // Returns: ['import { EventEmitter } from "events";']
   * ```
   */
  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    return this.nodeJSGenerator.generateNodeJSImports(resolvedType);
  }

  /**
   * Generates common utility import statements.
   *
   * @param config - Import generation configuration
   * @returns Result containing common import statements or error
   *
   * @example
   * ```typescript
   * const result = generator.generateCommonImports(config);
   * if (result.ok) {
   *   console.log(result.value); // 'import { FluentBuilderBase } from "./common.js";'
   * }
   * ```
   */
  generateCommonImports(config: ImportGeneratorConfig): Result<string, Error> {
    return this.commonGenerator.generateCommonImports(config);
  }

  /**
   * Generates type-only import statements for TypeScript types.
   *
   * @param resolvedType - Type information to analyze for type dependencies
   * @param outputDir - Optional output directory for relative path calculation
   * @returns Result containing type import statements or error
   *
   * @example
   * ```typescript
   * const result = generator.generateTypeImports(resolvedType, './dist');
   * if (result.ok) {
   *   console.log(result.value); // 'import type { User } from "./types.js";'
   * }
   * ```
   */
  generateTypeImports(resolvedType: ResolvedType, outputDir?: string): Result<string, Error> {
    return this.typeGenerator.generateTypeImports(resolvedType, outputDir);
  }

  /**
   * Generates external module/package import statements.
   *
   * @param resolvedType - Type information to analyze for external dependencies
   * @param excludeModules - Optional set of module names to exclude from generation
   * @returns Result containing module import statements or error
   *
   * @example
   * ```typescript
   * const excludes = new Set(['react']);
   * const result = generator.generateModuleImports(resolvedType, excludes);
   * if (result.ok) {
   *   console.log(result.value); // 'import type * as Lodash from "lodash";'
   * }
   * ```
   */
  generateModuleImports(
    resolvedType: ResolvedType,
    excludeModules?: Set<string>,
  ): Result<string, Error> {
    const result = this.packageResolver.generateModuleImports(resolvedType, excludeModules);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.join('\n'));
  }

  /**
   * Cleans up resources and disposes of generators.
   *
   * Should be called when the ImportGenerator is no longer needed
   * to free up any allocated resources.
   *
   * @example
   * ```typescript
   * const generator = new ImportGenerator();
   * // ... use generator
   * generator.dispose(); // Clean up
   * ```
   */
  dispose(): void {
    this.typeGenerator.dispose();
    if (hasDispose(this.packageResolver)) {
      this.packageResolver.dispose();
    }
  }

  private addCommonImports(
    config: ImportGeneratorConfig,
    imports: string[],
  ): Result<string, Error> {
    const commonImportsResult = this.commonGenerator.generateCommonImports(config);
    if (!commonImportsResult.ok) {
      return err(commonImportsResult.error);
    }

    addToImportsIfNotEmpty(imports, commonImportsResult.value);
    return ok('');
  }

  private addNodeJSImports(resolvedType: ResolvedType, imports: string[]): void {
    const nodeImports = this.nodeJSGenerator.generateNodeJSImports(resolvedType);
    if (nodeImports.length > 0) {
      imports.push(...nodeImports);
    }
  }

  private async addTypeImports(
    resolvedType: ResolvedType,
    config: ImportGeneratorConfig,
    imports: string[],
  ): Promise<Result<string, Error>> {
    const typeImportsResult = this.typeGenerator.generateTypeImports(
      resolvedType,
      config.outputDir,
    );

    if (!typeImportsResult.ok) {
      return typeImportsResult;
    }

    imports.push(typeImportsResult.value);
    return ok(typeImportsResult.value);
  }

  /**
   * Collects modules from type imports and preserved named imports.
   */
  private collectExcludedModules(resolvedType: ResolvedType, typeImports: string): Set<string> {
    const namedImportModules = extractModulesFromNamedImports(typeImports);

    if (resolvedType.imports && Array.isArray(resolvedType.imports)) {
      for (const importPath of resolvedType.imports) {
        if (isValidImportPath(importPath)) {
          if (this.packageResolver.shouldPreserveNamedImports(importPath, resolvedType)) {
            namedImportModules.add(importPath);
          }
        }
      }
    }

    return namedImportModules;
  }

  private addModuleImports(
    resolvedType: ResolvedType,
    typeImports: string,
    imports: string[],
  ): Result<string, Error> {
    try {
      const excludedModules = this.collectExcludedModules(resolvedType, typeImports);

      const moduleImportsResult = this.packageResolver.generateModuleImports(
        resolvedType,
        excludedModules,
      );

      if (!moduleImportsResult.ok) {
        return err(moduleImportsResult.error);
      }

      imports.push(...moduleImportsResult.value);
      return ok('');
    } catch (error) {
      return err(new Error(`Failed to add module imports: ${formatError(error)}`));
    }
  }
}
