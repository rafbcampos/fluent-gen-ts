import { z } from 'zod';
import { cosmiconfigSync } from 'cosmiconfig';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { MonorepoConfig as CoreMonorepoConfig } from '../core/package-resolver.js';

export const MonorepoConfigSchema = z
  .object({
    enabled: z.boolean(),
    workspaceRoot: z.string().optional(),
    dependencyResolutionStrategy: z
      .enum(['auto', 'workspace-root', 'hoisted', 'local-only'])
      .optional(),
    customPaths: z.array(z.string()).optional(),
  })
  .strict();

export const GeneratorConfigSchema = z
  .object({
    outputDir: z.string().optional(),
    useDefaults: z.boolean().optional(),
    contextType: z.string().optional(),
    importPath: z.string().optional(),
    addComments: z.boolean().optional(),
    generateCommonFile: z.boolean().optional(),
    naming: z
      .object({
        convention: z.enum(['camelCase', 'kebab-case', 'snake_case', 'PascalCase']).optional(),
        suffix: z.string().optional(),
        /** Custom transformation function as a string (e.g., "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()") */
        transform: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const TargetSchema = z
  .object({
    file: z.string(),
    types: z.array(z.string()).optional(),
    outputFile: z.string().optional(),
  })
  .strict();

export const ConfigSchema = z
  .object({
    tsConfigPath: z.string().optional(),
    monorepo: MonorepoConfigSchema.optional(),
    generator: GeneratorConfigSchema.optional(),
    targets: z.array(TargetSchema).optional(),
    patterns: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    plugins: z.array(z.string()).optional(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type GeneratorConfig = z.infer<typeof GeneratorConfigSchema>;
export type { CoreMonorepoConfig as MonorepoConfig };

/**
 * Loads and validates configuration files for fluentgen.
 *
 * Supports multiple configuration file formats including JSON, YAML, and JavaScript.
 * Configuration can be placed in various locations such as .fluentgenrc files,
 * fluentgen.config.js, or package.json.
 */
export class ConfigLoader {
  private readonly explorer = cosmiconfigSync('fluentgen', {
    searchPlaces: [
      '.fluentgenrc',
      '.fluentgenrc.json',
      '.fluentgenrc.yaml',
      '.fluentgenrc.yml',
      '.fluentgenrc.js',
      '.fluentgenrc.cjs',
      'fluentgen.config.js',
      'fluentgen.config.cjs',
      'package.json',
    ],
  });

  /**
   * Loads configuration from a file or searches for configuration in standard locations.
   *
   * @param configPath - Optional path to a specific configuration file.
   *                     If not provided, searches in standard locations.
   * @returns A Result containing the validated configuration or an error.
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader();
   * const config = loader.load();
   * if (config.ok) {
   *   console.log('Config loaded:', config.value);
   * }
   * ```
   */
  load(configPath?: string): Result<Config> {
    try {
      const result = configPath ? this.explorer.load(configPath) : this.explorer.search();

      if (!result) {
        return ok({});
      }

      return this.validate(result.config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to load configuration: ${message}`));
    }
  }

  /**
   * Validates a configuration object against the schema.
   *
   * @param config - The configuration object to validate.
   * @returns A Result containing the validated configuration or an error.
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader();
   * const result = loader.validate({ generator: { outputDir: './out' } });
   * if (result.ok) {
   *   console.log('Valid config:', result.value);
   * }
   * ```
   */
  validate(config: unknown): Result<Config> {
    const parsed = ConfigSchema.safeParse(config);

    if (!parsed.success) {
      return err(new Error(`Invalid configuration: ${parsed.error.message}`));
    }

    return ok(parsed.data);
  }
}
