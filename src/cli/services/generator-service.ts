import { dirname, basename } from 'node:path';
import { FluentGen, type FluentGenOptions } from '../../gen/index.js';
import type { Config, GeneratorConfig } from '../config.js';
import type { CommandOptions } from '../types.js';
import type { PluginManager } from '../../core/plugin.js';

export class GeneratorService {
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

    return result;
  }

  buildBaseOptions(generatorConfig?: GeneratorConfig): CommandOptions {
    const baseOptions: CommandOptions = {};

    if (generatorConfig?.outputDir !== undefined) {
      baseOptions.outputDir = generatorConfig.outputDir;
    }
    if (generatorConfig?.useDefaults !== undefined) {
      baseOptions.useDefaults = generatorConfig.useDefaults;
    }
    if (generatorConfig?.contextType !== undefined) {
      baseOptions.contextType = generatorConfig.contextType;
    }
    if (generatorConfig?.importPath !== undefined) {
      baseOptions.importPath = generatorConfig.importPath;
    }
    if (generatorConfig?.addComments !== undefined) {
      baseOptions.addComments = generatorConfig.addComments;
    }

    return baseOptions;
  }

  createGenerator(
    config: Config,
    pluginManager?: PluginManager,
    overrides?: Partial<CommandOptions>,
  ): FluentGen {
    const baseOptions = this.buildBaseOptions(config.generator);

    const genOptions = this.buildFluentGenOptions({
      ...baseOptions,
      ...(config.tsConfigPath !== undefined && {
        tsConfigPath: config.tsConfigPath,
      }),
      ...overrides,
    });

    return new FluentGen({
      ...genOptions,
      ...(pluginManager && { pluginManager }),
    });
  }

  mergeGeneratorOptions(
    config: Config,
    commandOptions: Partial<CommandOptions>,
    outputPath?: string,
  ): Partial<FluentGenOptions> {
    const baseOptions = this.buildBaseOptions(config.generator);

    let outputDir: string | undefined;
    let fileName: string | undefined;

    if (outputPath) {
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
