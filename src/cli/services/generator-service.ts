import { dirname, basename } from 'node:path';
import { FluentGen, type FluentGenOptions } from '../../gen/index.js';
import type { Config, GeneratorConfig } from '../config.js';
import type { CommandOptions } from '../types.js';
import type { PluginManager } from '../../core/plugin/index.js';
import type { MonorepoConfig } from '../../core/package-resolver.js';

/**
 * Service for creating and configuring FluentGen instances with various options
 * Handles option merging, validation, and generator instantiation
 */
export class GeneratorService {
  /**
   * Builds monorepo configuration from config options
   * @param monorepoConfig - The monorepo configuration from the main config
   * @returns Filtered monorepo configuration with only defined properties
   */
  private buildMonorepoConfig(monorepoConfig: NonNullable<Config['monorepo']>): MonorepoConfig {
    const result: Partial<MonorepoConfig> = {
      enabled: monorepoConfig.enabled,
    };

    if (monorepoConfig.workspaceRoot !== undefined) {
      result.workspaceRoot = monorepoConfig.workspaceRoot;
    }
    if (monorepoConfig.dependencyResolutionStrategy !== undefined) {
      result.dependencyResolutionStrategy = monorepoConfig.dependencyResolutionStrategy;
    }
    if (monorepoConfig.customPaths !== undefined) {
      result.customPaths = monorepoConfig.customPaths;
    }

    return result as MonorepoConfig;
  }

  /**
   * Transforms command options into FluentGen options format
   * Filters out undefined values to ensure clean option objects
   *
   * @param options - Command line options to transform
   * @returns Partial FluentGen options with only defined properties
   *
   * @example
   * ```typescript
   * const service = new GeneratorService();
   * const options = { outputDir: './gen', useDefaults: true };
   * const fluentOptions = service.buildFluentGenOptions(options);
   * // Returns: { outputDir: './gen', useDefaults: true }
   * ```
   */
  buildFluentGenOptions(options: CommandOptions): Partial<FluentGenOptions> {
    const result: Partial<FluentGenOptions> = {};

    if (options.tsConfigPath !== undefined) {
      result.tsConfigPath = options.tsConfigPath;
    }
    if (options.outputDir !== undefined) {
      result.outputDir = options.outputDir;
    }
    if (options.fileName !== undefined) {
      result.fileName = options.fileName;
    }
    if (options.useDefaults !== undefined) {
      result.useDefaults = options.useDefaults;
    }
    if (options.addComments !== undefined) {
      result.addComments = options.addComments;
    }
    if (options.contextType !== undefined) {
      result.contextType = options.contextType;
    }
    if (options.customCommonFilePath !== undefined) {
      result.customCommonFilePath = options.customCommonFilePath;
    }

    return result;
  }

  /**
   * Builds base command options from generator configuration
   * Acts as a bridge between config format and command options format
   *
   * @param generatorConfig - Optional generator configuration from config file
   * @returns Command options with defined properties from the config
   *
   * @example
   * ```typescript
   * const service = new GeneratorService();
   * const config = { outputDir: './generated', useDefaults: false };
   * const baseOptions = service.buildBaseOptions(config);
   * // Returns: { outputDir: './generated', useDefaults: false }
   * ```
   */
  buildBaseOptions(generatorConfig?: GeneratorConfig): Partial<CommandOptions> {
    if (!generatorConfig) {
      return {};
    }

    const result: Partial<CommandOptions> = {};

    if (generatorConfig.outputDir !== undefined) {
      result.outputDir = generatorConfig.outputDir;
    }
    if (generatorConfig.useDefaults !== undefined) {
      result.useDefaults = generatorConfig.useDefaults;
    }
    if (generatorConfig.contextType !== undefined) {
      result.contextType = generatorConfig.contextType;
    }
    if (generatorConfig.customCommonFilePath !== undefined) {
      result.customCommonFilePath = generatorConfig.customCommonFilePath;
    }
    if (generatorConfig.addComments !== undefined) {
      result.addComments = generatorConfig.addComments;
    }

    return result;
  }

  /**
   * Creates a fully configured FluentGen instance
   * Combines configuration, plugin management, and option overrides into a ready-to-use generator
   *
   * @param params - Configuration parameters for generator creation
   * @param params.config - Main configuration object containing generator settings
   * @param params.pluginManager - Optional plugin manager for extending functionality
   * @param params.overrides - Optional command-specific overrides to apply on top of config
   * @returns Configured FluentGen instance ready for use
   *
   * @example
   * ```typescript
   * const service = new GeneratorService();
   * const generator = service.createGenerator({
   *   config: {
   *     generator: { outputDir: './gen' },
   *     tsConfigPath: './tsconfig.json'
   *   }
   * });
   * ```
   */
  createGenerator({
    config,
    pluginManager,
    overrides,
  }: {
    config: Config;
    pluginManager?: PluginManager;
    overrides?: Partial<CommandOptions>;
  }): FluentGen {
    const baseOptions = this.buildBaseOptions(config.generator);

    const genOptions = this.buildFluentGenOptions({
      ...baseOptions,
      ...(config.tsConfigPath !== undefined && {
        tsConfigPath: config.tsConfigPath,
      }),
      ...overrides,
    });

    const fluentGenOptions: FluentGenOptions = {
      ...genOptions,
      ...(pluginManager && { pluginManager }),
    };

    if (config.monorepo && config.monorepo.enabled) {
      fluentGenOptions.monorepoConfig = this.buildMonorepoConfig(config.monorepo);
    }

    // Convert factoryTransform string to namingStrategy function
    if (config.generator?.naming?.factoryTransform) {
      try {
        const transformStr = config.generator.naming.factoryTransform;
        const namingStrategy = new Function('typeName', `return (${transformStr})(typeName)`) as (
          typeName: string,
        ) => string;
        fluentGenOptions.namingStrategy = namingStrategy;
      } catch (error) {
        console.warn(
          `Warning: Invalid factoryTransform function, ignoring: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return new FluentGen(fluentGenOptions);
  }

  /**
   * Merges configuration, command options, and output path into generator options
   * Handles complex option precedence: command options override config, output path overrides both
   *
   * @param params - Parameters for merging generator options
   * @param params.config - Main configuration object
   * @param params.commandOptions - Command-specific options that override config
   * @param params.outputPath - Optional output path that gets split into outputDir and fileName
   * @returns Merged FluentGen options with proper precedence handling
   *
   * @example
   * ```typescript
   * const service = new GeneratorService();
   * const options = service.mergeGeneratorOptions({
   *   config: { generator: { outputDir: './gen' } },
   *   commandOptions: { useDefaults: true },
   *   outputPath: './custom/output.ts'
   * });
   * // Returns: { outputDir: './custom', fileName: 'output.ts', useDefaults: true }
   * ```
   */
  mergeGeneratorOptions({
    config,
    commandOptions,
    outputPath,
  }: {
    config: Config;
    commandOptions: Partial<CommandOptions>;
    outputPath?: string;
  }): Partial<FluentGenOptions> {
    const baseOptions = this.buildBaseOptions(config.generator);

    let outputDir: string | undefined;
    let fileName: string | undefined;

    if (outputPath !== undefined) {
      outputDir = dirname(outputPath);
      fileName = basename(outputPath);
    }

    const tsConfigPath = commandOptions.tsConfigPath ?? config.tsConfigPath;

    return this.buildFluentGenOptions({
      ...baseOptions,
      ...(tsConfigPath !== undefined && { tsConfigPath }),
      ...(outputDir !== undefined && { outputDir }),
      ...(fileName !== undefined && { fileName }),
      ...(commandOptions.useDefaults !== undefined && {
        useDefaults: commandOptions.useDefaults,
      }),
      ...(commandOptions.addComments !== undefined && {
        addComments: commandOptions.addComments,
      }),
    });
  }
}
