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

export class PluginIntegration {
  async processPluginImports(
    baseImports: string[],
    resolvedType: ResolvedType,
    config: ImportGeneratorConfig,
  ): Promise<Result<string, Error>> {
    try {
      if (!config.pluginManager) {
        return ok(baseImports.join('\n'));
      }

      const imports = [...baseImports];

      const pluginImports = this.collectPluginImports(config.pluginManager);
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
      return err(new Error(`Failed to process plugin imports: ${error}`));
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
      if (!config.pluginManager) {
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

      const transformResult = await config.pluginManager.executeHook({
        hookType: HookType.TransformImports,
        input: transformContext,
      });

      if (!transformResult.ok) {
        return err(new Error(`Plugin transformation failed: ${transformResult.error}`));
      }

      // Extract the transformed imports from the result context
      const transformedImports = ImportSerializer.serializeImports(transformResult.value.imports);
      return ok(transformedImports);
    } catch (error) {
      return err(new Error(`Failed to apply plugin transformations: ${error}`));
    }
  }
}
