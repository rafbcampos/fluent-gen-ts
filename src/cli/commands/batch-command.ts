import chalk from 'chalk';
import ora from 'ora';
import { isOk } from '../../core/result.js';
import type { BatchOptions } from '../types.js';
import type { Config, Target } from '../config.js';
import type { PluginManager } from '../../core/plugin/index.js';
import {
  createBatchCommandServices,
  type BatchCommandServices,
} from '../shared/command-services.js';

type ValidatedConfig = Config & { targets: Target[] };

/**
 * Error thrown when batch command execution fails.
 */
export class BatchCommandError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BatchCommandError';
  }
}

/**
 * Handles batch generation of builders from configuration files.
 * Orchestrates configuration loading, plugin management, and task execution.
 */
export class BatchCommand {
  private readonly services: BatchCommandServices;

  constructor(services?: BatchCommandServices) {
    this.services = services ?? createBatchCommandServices();
  }

  /**
   * Executes the batch generation command.
   * @param options - Command options including config path, plugins, dryRun, and parallel flags
   */
  async execute(options: BatchOptions = {}): Promise<void> {
    try {
      const config = await this.loadAndValidateConfig(options);
      const pluginManager = await this.loadPluginsIfNeeded(options, config);
      const result = await this.runGeneration(options, config, pluginManager);
      this.printSummary(result);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async loadAndValidateConfig(options: BatchOptions): Promise<ValidatedConfig> {
    const { configLoader } = this.services;

    this.printSectionHeader('Configuration Phase');
    const configPath = options.config || 'default search path';
    console.log(chalk.gray(`Config: ${configPath}`));
    console.log();

    const configResult = await configLoader.load(options.config);
    if (!isOk(configResult)) {
      console.error(chalk.red('✖ Failed to load configuration'));
      console.error(configResult.error);
      throw new BatchCommandError('Failed to load configuration', configResult.error);
    }

    const config = configResult.value;
    console.log(chalk.green('✔ Configuration loaded'));

    if (!config.targets || config.targets.length === 0) {
      console.error(chalk.red('✖ No targets found in configuration'));
      throw new BatchCommandError('No targets found in configuration');
    }

    return config as ValidatedConfig;
  }

  private async loadPluginsIfNeeded(
    options: BatchOptions,
    config: ValidatedConfig,
  ): Promise<PluginManager | undefined> {
    const { pluginService } = this.services;
    const allPluginPaths = pluginService.mergePluginPaths(options.plugins, config.plugins);

    if (allPluginPaths.length === 0) {
      return undefined;
    }

    this.printSectionHeader('Plugin Phase');
    const pluginManager = await pluginService.loadPlugins(allPluginPaths);
    console.log(chalk.green(`✔ Loaded ${allPluginPaths.length} plugin(s)`));

    return pluginManager;
  }

  private async runGeneration(
    options: BatchOptions,
    config: ValidatedConfig,
    pluginManager: PluginManager | undefined,
  ): Promise<{ successCount: number; failCount: number; errors: string[] }> {
    const { generatorService, taskRunner } = this.services;

    this.printSectionHeader('Generation Phase');
    console.log(chalk.gray(`Processing ${config.targets.length} target(s)...\n`));

    const generator = generatorService.createGenerator({
      config,
      ...(pluginManager && { pluginManager }),
    });
    const spinner = ora();
    const tasks = taskRunner.createTasksFromTargets(config.targets);

    // Determine batching strategy: batch together if using common file
    // If customCommonFilePath is NOT set, we generate common.ts (default behavior)
    // If customCommonFilePath IS set, user has their own common file for all builders
    // In both cases, we can batch tasks together since they share a common file
    const shouldBatchTogether = true;

    const result = await taskRunner.runTasks(tasks, generator, {
      ...(options.parallel !== undefined && { parallel: options.parallel }),
      ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
      generateCommonFile: shouldBatchTogether,
      ...(config.generator && { generatorConfig: config.generator }),
      onProgress: message => {
        spinner.start(message);
      },
    });

    spinner.stop();
    return result;
  }

  private printSummary(result: {
    successCount: number;
    failCount: number;
    errors: string[];
  }): void {
    this.printSectionHeader('Summary');
    console.log(
      chalk.green(
        `✔ Batch generation complete: ${result.successCount} succeeded, ${result.failCount} failed`,
      ),
    );

    if (result.errors.length > 0) {
      console.log(chalk.bold('\nErrors:'));
      result.errors.forEach(error => {
        console.error(chalk.yellow(`  ⚠ ${error}`));
      });
    }
  }

  private printSectionHeader(title: string): void {
    console.log(chalk.bold(`\n━━━ ${title} ━━━`));
  }

  private handleError(error: unknown): never {
    console.error(chalk.red('✖ Unexpected error'));
    console.error(error);
    if (error instanceof BatchCommandError) {
      throw error;
    }
    throw new BatchCommandError('Unexpected error during batch execution', error);
  }
}
