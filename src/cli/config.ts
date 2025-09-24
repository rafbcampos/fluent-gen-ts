import { z } from 'zod';
import { cosmiconfigSync } from 'cosmiconfig';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { MonorepoConfig as CoreMonorepoConfig } from '../core/package-resolver.js';

export const MonorepoConfigSchema = z.object({
  enabled: z.boolean(),
  workspaceRoot: z.string().optional(),
  dependencyResolutionStrategy: z
    .enum(['auto', 'workspace-root', 'hoisted', 'local-only'])
    .optional(),
  customPaths: z.array(z.string()).optional(),
});

export const GeneratorConfigSchema = z.object({
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
    .optional(),
});

export const TargetSchema = z.object({
  file: z.string(),
  types: z.array(z.string()).optional(),
  outputFile: z.string().optional(),
});

export const ConfigSchema = z.object({
  tsConfigPath: z.string().optional(),
  monorepo: MonorepoConfigSchema.optional(),
  generator: GeneratorConfigSchema.optional(),
  targets: z.array(TargetSchema).optional(),
  patterns: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  plugins: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type GeneratorConfig = z.infer<typeof GeneratorConfigSchema>;
export type { CoreMonorepoConfig as MonorepoConfig };

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

  load(configPath?: string): Result<Config> {
    try {
      const result = configPath ? this.explorer.load(configPath) : this.explorer.search();

      if (!result) {
        return ok({});
      }

      const parsed = ConfigSchema.safeParse(result.config);

      if (!parsed.success) {
        return err(new Error(`Invalid configuration: ${parsed.error.message}`));
      }

      return ok(parsed.data);
    } catch (error) {
      return err(new Error(`Failed to load configuration: ${error}`));
    }
  }

  validate(config: unknown): Result<Config> {
    const parsed = ConfigSchema.safeParse(config);

    if (!parsed.success) {
      return err(new Error(`Invalid configuration: ${parsed.error.message}`));
    }

    return ok(parsed.data);
  }
}
