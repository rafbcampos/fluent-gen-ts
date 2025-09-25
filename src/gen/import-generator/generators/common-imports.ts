import type { ImportGeneratorConfig } from '../types.js';
import { validateImportPath } from '../utils/validation.js';
import { ok, err } from '../../../core/result.js';
import type { Result } from '../../../core/result.js';

export class CommonImportsGenerator {
  generateCommonImports(config: ImportGeneratorConfig): Result<string, Error> {
    try {
      if (!this.shouldGenerateCommonImports(config)) {
        return ok('');
      }

      const validationResult = validateImportPath(config.commonImportPath);
      if (!validationResult.ok) {
        return err(new Error(`Invalid common import path: ${validationResult.error}`));
      }

      const commonImports = this.createCommonImportStatements(config.commonImportPath);
      return ok(commonImports);
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error(`Failed to generate common imports: ${error}`),
      );
    }
  }

  private shouldGenerateCommonImports(config: ImportGeneratorConfig): boolean {
    return config.isGeneratingMultiple || Boolean(config.hasExistingCommon);
  }

  private createCommonImportStatements(commonImportPath: string): string {
    return `import type {
  FluentBuilder,
  BaseBuildContext,
} from "${commonImportPath}";
import {
  FluentBuilderBase,
  createInspectMethod
} from "${commonImportPath}";`;
  }
}
