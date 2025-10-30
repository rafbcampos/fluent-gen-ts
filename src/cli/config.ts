import { z } from 'zod';
import { cosmiconfig, type Loader } from 'cosmiconfig';
import { pathToFileURL } from 'node:url';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { MonorepoConfig as CoreMonorepoConfig } from '../core/package-resolver.js';

/**
 * Custom loader for TypeScript config files using tsx
 */
const typescriptLoader: Loader = async (filepath: string) => {
  // Dynamic import with string variable to prevent bundler from resolving at build time
  const tsxModule = 'tsx/esm/api';
  const { register } = await import(/* @vite-ignore */ tsxModule);
  const unregister = register();

  try {
    const fileUrl = pathToFileURL(filepath).href;
    const module = await import(fileUrl);
    return module.default ?? module;
  } finally {
    unregister();
  }
};

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
    customCommonFilePath: z.string().optional(),
    addComments: z.boolean().optional(),
    naming: z
      .object({
        convention: z.enum(['camelCase', 'kebab-case', 'snake_case', 'PascalCase']).optional(),
        suffix: z.string().optional(),
        /** Custom transformation function as a string (e.g., "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()") */
        transform: z.string().optional(),
        /** Custom transformation function for factory function names as a string (e.g., "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()") */
        factoryTransform: z.string().optional(),
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
  private readonly explorer = cosmiconfig('fluentgen', {
    searchPlaces: [
      '.fluentgenrc',
      '.fluentgenrc.json',
      '.fluentgenrc.yaml',
      '.fluentgenrc.yml',
      '.fluentgenrc.js',
      '.fluentgenrc.cjs',
      '.fluentgenrc.ts',
      '.fluentgenrc.mts',
      '.fluentgenrc.cts',
      'fluentgen.config.js',
      'fluentgen.config.cjs',
      'fluentgen.config.ts',
      'fluentgen.config.mts',
      'fluentgen.config.cts',
      'package.json',
    ],
    loaders: {
      '.ts': typescriptLoader,
      '.mts': typescriptLoader,
      '.cts': typescriptLoader,
    },
  });

  /**
   * Loads configuration from a file or searches for configuration in standard locations.
   *
   * @param configPath - Optional path to a specific configuration file.
   *                     If not provided, searches in standard locations.
   * @returns A Promise resolving to a Result containing the validated configuration or an error.
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader();
   * const config = await loader.load();
   * if (config.ok) {
   *   console.log('Config loaded:', config.value);
   * }
   * ```
   */
  async load(configPath?: string): Promise<Result<Config>> {
    try {
      const result = configPath
        ? await this.explorer.load(configPath)
        : await this.explorer.search();

      if (!result) {
        return ok({});
      }

      // Extract default export if present (ES modules)
      const config =
        result.config && typeof result.config === 'object' && 'default' in result.config
          ? result.config.default
          : result.config;

      return this.validate(config);
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
