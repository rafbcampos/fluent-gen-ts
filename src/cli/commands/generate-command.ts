import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { isOk } from '../../core/result.js';
import type { GenerateOptions } from '../types.js';
import type { PluginManager } from '../../core/plugin/index.js';
import { CommandUtils } from '../shared/command-utils.js';
import { createCoreCommandServices, type CoreCommandServices } from '../shared/command-services.js';

/**
 * Command for generating fluent builder code for a specific TypeScript type.
 * Handles configuration loading, plugin initialization, and code generation.
 */
export class GenerateCommand {
  private readonly services: CoreCommandServices;

  constructor(services?: CoreCommandServices) {
    this.services = services ?? createCoreCommandServices();
  }

  private handleError(spinner: Ora, message: string, error: unknown): never {
    spinner.fail(chalk.red(message));
    CommandUtils.handleCommandError(error, message);
  }

  /**
   * Executes the generate command to create a fluent builder for a TypeScript type.
   *
   * @param file - Path to the TypeScript file containing the target type
   * @param typeName - Name of the type to generate a builder for
   * @param options - Generation options
   * @param options.output - Output file path. If provided and not in dry-run mode, writes to file. Otherwise prints to console.
   * @param options.config - Path to configuration file
   * @param options.tsconfig - Path to tsconfig.json
   * @param options.plugins - Array of plugin paths to load
   * @param options.defaults - Whether to include default values in the builder
   * @param options.comments - Whether to add comments to generated code
   * @param options.dryRun - If true, generates code but does not write to file
   *
   * @throws {Error} If configuration loading fails
   * @throws {Error} If builder generation fails
   */
  async execute(file: string, typeName: string, options: GenerateOptions = {}): Promise<void> {
    const spinner = ora('Loading configuration...').start();
    const { configLoader, pluginService, generatorService } = this.services;

    try {
      const configResult = await configLoader.load(options.config);
      if (!isOk(configResult)) {
        this.handleError(spinner, 'Failed to load configuration', configResult.error);
      }

      const config = configResult.value;

      const allPluginPaths = pluginService.mergePluginPaths(options.plugins, config.plugins);

      let pluginManager: PluginManager | undefined = undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = 'Loading plugins...';
        pluginManager = await pluginService.loadPlugins(allPluginPaths);
      }

      spinner.text = 'Initializing generator...';

      const commandOptions: Partial<import('../types.js').CommandOptions> = {};
      if (options.tsconfig !== undefined) {
        commandOptions.tsConfigPath = options.tsconfig;
      }
      if (options.defaults !== undefined) {
        commandOptions.useDefaults = options.defaults;
      }
      if (options.comments !== undefined) {
        commandOptions.addComments = options.comments;
      }

      const genOptions = generatorService.mergeGeneratorOptions({
        config,
        commandOptions,
        ...(options.output && { outputPath: options.output }),
      });

      const generator = generatorService.createGenerator({
        config,
        ...(pluginManager && { pluginManager }),
        overrides: genOptions,
      });

      spinner.text = `Generating builder for ${chalk.cyan(typeName)}...`;

      if (options.output && !options.dryRun) {
        const result = await generator.generateToFile(file, typeName, options.output);
        if (!isOk(result)) {
          this.handleError(spinner, 'Generation failed', result.error);
        }
        spinner.succeed(chalk.green(`✓ Generated builder at ${chalk.cyan(options.output)}`));
      } else {
        const result = await generator.generateBuilder(file, typeName);
        if (!isOk(result)) {
          this.handleError(spinner, 'Generation failed', result.error);
        }

        if (options.dryRun) {
          spinner.succeed(chalk.green('✓ Dry-run complete (no files written)'));
          console.log(chalk.gray('\nGenerated code preview:'));
        } else {
          spinner.succeed(chalk.green('✓ Generation complete'));
        }
        console.log(result.value);
      }
    } catch (error) {
      this.handleError(spinner, 'Unexpected error', error);
    }
  }
}
