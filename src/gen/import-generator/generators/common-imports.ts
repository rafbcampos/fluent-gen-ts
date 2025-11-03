import type { ImportGeneratorConfig } from '../types.js';
import { validateImportPath } from '../utils/validation.js';
import { ok, err } from '../../../core/result.js';
import type { Result } from '../../../core/result.js';
import { formatError } from '../../../core/utils/error-utils.js';

/**
 * Generator for common import statements in fluent builder patterns.
 * Handles generation of shared imports for multiple or existing common modules.
 */
export class CommonImportsGenerator {
  /**
   * Generates common import statements for fluent builder base types.
   * @param config - Import generator configuration
   * @returns Result containing the generated import statements or an error
   * @example
   * ```typescript
   * const generator = new CommonImportsGenerator();
   * const result = generator.generateCommonImports({
   *   isGeneratingMultiple: true,
   *   commonImportPath: './common.js',
   *   outputDir: './dist'
   * });
   * ```
   */
  generateCommonImports(config: ImportGeneratorConfig): Result<string, Error> {
    try {
      if (!this.shouldGenerateCommonImports(config)) {
        return ok('');
      }

      const validationResult = validateImportPath(config.commonImportPath);
      if (!validationResult.ok) {
        return err(
          new Error(
            `Invalid common import path '${config.commonImportPath}': ${validationResult.error}`,
          ),
        );
      }

      const commonImports = this.createCommonImportStatements(config.commonImportPath);
      return ok(commonImports);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to generate common imports: ${formatError(error)}`),
      );
    }
  }

  /**
   * Determines whether common imports should be generated based on configuration.
   * @param config - Import generator configuration
   * @returns True if generating multiple files or if existing common module exists
   */
  private shouldGenerateCommonImports(config: ImportGeneratorConfig): boolean {
    return config.isGeneratingMultiple || Boolean(config.hasExistingCommon);
  }

  /**
   * Creates the actual import statements for common fluent builder types.
   * @param commonImportPath - Path to the common module
   * @returns Formatted import statements for type and value imports
   */
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
