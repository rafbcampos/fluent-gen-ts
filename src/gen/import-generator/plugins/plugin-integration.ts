import type { PluginManager, ImportTransformContext } from '../../../core/plugin/index.js';
import { HookType } from '../../../core/plugin/index.js';
import type { ResolvedType } from '../../../core/types.js';
import type { Result } from '../../../core/result.js';
import type { ImportGeneratorConfig } from '../types.js';
import { deduplicateImports } from '../utils/deduplication.js';
import { ok, err } from '../../../core/result.js';
import {
  ImportParser,
  ImportSerializer,
  ImportTransformUtilsImpl,
} from '../../../core/plugin/import-transformer.js';

/**
 * Handles integration of plugin-generated imports with base imports.
 *
 * This class manages the collection of plugin imports, applies plugin transformations,
 * and ensures proper deduplication throughout the process.
 */
export class PluginIntegration {
  private hasPluginManager(config: ImportGeneratorConfig): boolean {
    return Boolean(config.pluginManager);
  }

  /**
   * Processes and integrates plugin imports with base imports.
   *
   * This method:
   * 1. Collects imports required by plugins
   * 2. Merges them with base imports
   * 3. Applies plugin transformations to the combined imports
   * 4. Deduplicates imports at multiple stages to ensure uniqueness
   *
   * @param baseImports - Array of base import statements to start with
   * @param resolvedType - The resolved type information for context
   * @param config - Configuration including plugin manager and generation settings
   * @returns Promise resolving to either the final import string or an error
   *
   * @example
   * ```typescript
   * const integration = new PluginIntegration();
   * const result = await integration.processPluginImports(
   *   ['import type { User } from "./types.js";'],
   *   resolvedType,
   *   config
   * );
   *
   * if (result.ok) {
   *   console.log(result.value); // Combined and transformed import statements
   * }
   * ```
   */
  async processPluginImports(
    baseImports: string[],
    resolvedType: ResolvedType,
    config: ImportGeneratorConfig,
  ): Promise<Result<string, Error>> {
    try {
      if (!this.hasPluginManager(config)) {
        return ok(baseImports.join('\n'));
      }

      const imports = [...baseImports];

      const pluginImports = this.collectPluginImports(config.pluginManager!);
      imports.push(...pluginImports);

      let uniqueImports = deduplicateImports(imports);

      const transformedImports = await this.applyPluginTransformations(
        uniqueImports,
        resolvedType,
        config,
      );

      if (!transformedImports.ok) {
        return err(transformedImports.error);
      }

      const finalImports = deduplicateImports(transformedImports.value);

      return ok(finalImports.join('\n'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to process plugin imports: ${errorMessage}`));
    }
  }

  private collectPluginImports(pluginManager: PluginManager): string[] {
    const pluginImports = pluginManager.getRequiredImports();
    return pluginImports.toImportStatements();
  }

  private async applyPluginTransformations(
    imports: string[],
    resolvedType: ResolvedType,
    config: ImportGeneratorConfig,
  ): Promise<Result<string[], Error>> {
    try {
      if (!this.hasPluginManager(config)) {
        return ok(imports);
      }

      // Parse string imports to structured imports
      const structuredImports = ImportParser.parseImports(imports);

      const transformContext: ImportTransformContext = {
        imports: structuredImports,
        resolvedType,
        isGeneratingMultiple: config.isGeneratingMultiple,
        hasExistingCommon: config.hasExistingCommon ?? false,
        utils: new ImportTransformUtilsImpl(),
      };

      const transformResult = await config.pluginManager!.executeHook({
        hookType: HookType.TransformImports,
        input: transformContext,
      });

      if (!transformResult.ok) {
        const errorMessage =
          transformResult.error instanceof Error
            ? transformResult.error.message
            : String(transformResult.error);
        return err(new Error(`Plugin transformation failed: ${errorMessage}`));
      }

      // Extract the transformed imports from the result context
      const transformedImports = ImportSerializer.serializeImports(transformResult.value.imports);
      return ok(transformedImports);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to apply plugin transformations: ${errorMessage}`));
    }
  }
}
