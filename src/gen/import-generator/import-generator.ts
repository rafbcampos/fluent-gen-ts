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

export class ImportGenerator {
  private readonly nodeJSGenerator: NodeJSImportsGenerator;
  private readonly commonGenerator = new CommonImportsGenerator();
  private readonly typeGenerator = new TypeImportsGenerator();
  private readonly packageResolver = new PackageResolver();
  private readonly pluginIntegration = new PluginIntegration();

  constructor(tsConfigPath?: string) {
    this.nodeJSGenerator = new NodeJSImportsGenerator(tsConfigPath);
  }

  async generateAllImports(context: ImportGenerationContext): Promise<Result<string, Error>> {
    try {
      const { resolvedType, config } = context;

      if (!resolvedType || !config) {
        return err(new Error('Invalid resolved type or configuration'));
      }

      const imports: string[] = [];

      const commonImportsResult = this.addCommonImports(config, imports);
      if (!commonImportsResult.ok) {
        return commonImportsResult;
      }

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

      const finalResult = await this.pluginIntegration.processPluginImports(
        imports,
        resolvedType,
        config,
      );

      return finalResult;
    } catch (error) {
      return err(new Error(`Failed to generate all imports: ${error}`));
    }
  }

  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    return this.nodeJSGenerator.generateNodeJSImports(resolvedType);
  }

  generateCommonImports(config: ImportGeneratorConfig): Result<string, Error> {
    const result = this.commonGenerator.generateCommonImports(config);
    return result.ok ? ok(result.value) : err(result.error);
  }

  generateTypeImports(resolvedType: ResolvedType, outputDir?: string): Result<string, Error> {
    return this.typeGenerator.generateTypeImports(resolvedType, outputDir);
  }

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

  dispose(): void {
    this.typeGenerator.dispose();
    if (typeof this.packageResolver.dispose === 'function') {
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

    if (commonImportsResult.value) {
      imports.push(commonImportsResult.value);
    }

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

  private addModuleImports(
    resolvedType: ResolvedType,
    typeImports: string,
    imports: string[],
  ): Result<string, Error> {
    try {
      let namedImportModules = extractModulesFromNamedImports(typeImports);

      if (resolvedType.imports && Array.isArray(resolvedType.imports)) {
        for (const importPath of resolvedType.imports) {
          if (typeof importPath === 'string' && importPath.trim() !== '') {
            if (this.packageResolver.shouldPreserveNamedImports(importPath, resolvedType)) {
              namedImportModules.add(importPath);
            }
          }
        }
      }

      const moduleImportsResult = this.packageResolver.generateModuleImports(
        resolvedType,
        namedImportModules,
      );

      if (!moduleImportsResult.ok) {
        return err(moduleImportsResult.error);
      }

      imports.push(...moduleImportsResult.value);
      return ok('');
    } catch (error) {
      return err(new Error(`Failed to add module imports: ${error}`));
    }
  }
}
